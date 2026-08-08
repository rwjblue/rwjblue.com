#!/usr/bin/env python3
"""
Radiation-pattern model for N1RWJ's 58 ft center-fed portable doublet.

Model:
- 58 ft total radiating wire, 29 ft per leg
- Symmetric inverted V, 120 degree included apex angle
- Center heights: 20 ft and 30 ft
- Average ground: relative permittivity 13, conductivity 0.005 S/m
- Thin-wire sinusoidal standing-current approximation
- Direct numerical far-field integration with complex Fresnel ground reflection
- Ideal balanced feedline; the 28 ft, 14 mm-spaced line is omitted from the
  far-field model because equal/opposite differential currents nearly cancel

This is not a full NEC-2 solution. It is intended to show normalized lobe shape,
bearing, and approximate takeoff angle. It does not predict realized gain,
matching loss, tuner range, or common-mode feedline radiation.

Dependencies:
    numpy matplotlib pillow reportlab

Usage:
    python scripts/radio/generate-58ft-doublet-radiation-patterns.py [output_directory]
"""

from __future__ import annotations

import csv
import math
import sys
import tempfile
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageDraw
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


C = 299_792_458.0
EPS0 = 8.854_187_8128e-12
FT = 0.3048

TOTAL_WIRE_FT = 58.0
LEG_FT = 29.0
APEX_DEG = 120.0
CENTER_HEIGHTS_FT = (20.0, 30.0)

GROUND_ER = 13.0
GROUND_SIGMA_S_M = 0.005

BANDS = (
    ("40m", 7.05),
    ("20m", 14.05),
    ("17m", 18.08),
    ("15m", 21.05),
    ("12m", 24.91),
    ("10m", 28.05),
)

ELEVATIONS_DEG = np.arange(1.0, 91.0, 1.0)
AZIMUTHS_DEG = np.arange(0.0, 360.0, 2.0)
DB_FLOOR = -30.0


def save_pdf_plot(fig: Any, output_path: Path) -> None:
    """Save a compact, print-quality JPEG for embedding in the PDF."""
    fig.savefig(
        output_path,
        dpi=110,
        bbox_inches="tight",
        pil_kwargs={"quality": 70, "optimize": True},
    )


def geometry_samples(
    center_ft: float,
    apex_deg: float = APEX_DEG,
    leg_ft: float = LEG_FT,
    n_per_leg: int = 180,
) -> dict[str, Any]:
    """Return Gaussian-quadrature samples for both straight wire legs."""
    leg_m = leg_ft * FT
    half_droop_rad = math.radians((180.0 - apex_deg) / 2.0)

    horizontal_m = leg_m * math.cos(half_droop_rad)
    drop_m = leg_m * math.sin(half_droop_rad)
    center_m = center_ft * FT
    end_m = center_m - drop_m

    west = np.array([-horizontal_m, 0.0, end_m])
    apex = np.array([0.0, 0.0, center_m])
    east = np.array([horizontal_m, 0.0, end_m])

    nodes, weights = np.polynomial.legendre.leggauss(n_per_leg)
    q = (nodes + 1.0) * leg_m / 2.0
    w = weights * leg_m / 2.0

    t_left = (apex - west) / leg_m
    t_right = (east - apex) / leg_m

    r_left = west[None, :] + q[:, None] * t_left[None, :]
    r_right = apex[None, :] + q[:, None] * t_right[None, :]

    return {
        "leg_m": leg_m,
        "center_m": center_m,
        "end_m": end_m,
        "horizontal_m": horizontal_m,
        "west": west,
        "apex": apex,
        "east": east,
        "q": q,
        "w": w,
        "t_left": t_left,
        "t_right": t_right,
        "r_left": r_left,
        "r_right": r_right,
    }


def current_vectors(
    geometry: dict[str, Any],
    frequency_mhz: float,
) -> tuple[np.ndarray, np.ndarray, float]:
    """
    Build weighted vector-current samples.

    Current is zero at both free ends and follows the usual sinusoidal
    standing-current approximation along each half of a center-fed wire.
    """
    k = 2.0 * math.pi * frequency_mhz * 1e6 / C
    q = geometry["q"]
    leg_m = geometry["leg_m"]
    w = geometry["w"]

    i_left = np.sin(k * q)
    i_right = np.sin(k * (leg_m - q))

    j_left = i_left[:, None] * geometry["t_left"][None, :] * w[:, None]
    j_right = i_right[:, None] * geometry["t_right"][None, :] * w[:, None]

    positions = np.vstack((geometry["r_left"], geometry["r_right"]))
    weighted_currents = np.vstack((j_left, j_right))
    return positions, weighted_currents, k


def free_space_far_field(
    positions: np.ndarray,
    weighted_currents: np.ndarray,
    k: float,
    directions: np.ndarray,
    chunk_size: int = 2500,
) -> np.ndarray:
    """Numerically integrate the transverse far field in each direction."""
    directions = np.asarray(directions)
    result = np.empty((len(directions), 3), dtype=np.complex128)

    for start in range(0, len(directions), chunk_size):
        direction_chunk = directions[start : start + chunk_size]
        phase = np.exp(1j * k * (direction_chunk @ positions.T))
        vector_potential = phase @ weighted_currents
        longitudinal = np.sum(vector_potential * direction_chunk, axis=1)
        result[start : start + chunk_size] = (
            vector_potential - longitudinal[:, None] * direction_chunk
        )

    return result


def fresnel_coefficients(
    elevation_rad: np.ndarray,
    frequency_mhz: float,
    er: float = GROUND_ER,
    sigma_s_m: float = GROUND_SIGMA_S_M,
) -> tuple[np.ndarray, np.ndarray]:
    """Complex electric-field reflection coefficients for average ground."""
    frequency_hz = frequency_mhz * 1e6
    complex_er = er - 1j * sigma_s_m / (2.0 * math.pi * frequency_hz * EPS0)

    sin_elevation = np.sin(elevation_rad)
    cos_elevation = np.cos(elevation_rad)
    root = np.sqrt(complex_er - cos_elevation**2)

    gamma_te = (sin_elevation - root) / (sin_elevation + root)
    gamma_tm = (
        complex_er * sin_elevation - root
    ) / (
        complex_er * sin_elevation + root
    )
    return gamma_te, gamma_tm


def calculate_pattern(
    center_ft: float,
    frequency_mhz: float,
    apex_deg: float = APEX_DEG,
    elevations_deg: np.ndarray = ELEVATIONS_DEG,
    azimuths_deg: np.ndarray = AZIMUTHS_DEG,
) -> dict[str, Any]:
    """
    Calculate an upper-hemisphere power pattern.

    Coordinate convention:
    - Wire runs east-west.
    - Azimuth 0 = north, 90 = east, clockwise.
    - Broadside is north-south.
    """
    geometry = geometry_samples(center_ft, apex_deg)
    positions, weighted_currents, k = current_vectors(geometry, frequency_mhz)

    elevation_grid, azimuth_grid = np.meshgrid(
        np.radians(elevations_deg),
        np.radians(azimuths_deg),
        indexing="ij",
    )

    horizontal = np.cos(elevation_grid)

    upward_directions = np.stack(
        (
            horizontal * np.sin(azimuth_grid),
            horizontal * np.cos(azimuth_grid),
            np.sin(elevation_grid),
        ),
        axis=-1,
    ).reshape(-1, 3)

    downward_directions = np.stack(
        (
            horizontal * np.sin(azimuth_grid),
            horizontal * np.cos(azimuth_grid),
            -np.sin(elevation_grid),
        ),
        axis=-1,
    ).reshape(-1, 3)

    direct_field = free_space_far_field(
        positions, weighted_currents, k, upward_directions
    )
    incident_field = free_space_far_field(
        positions, weighted_currents, k, downward_directions
    )

    flat_azimuth = azimuth_grid.reshape(-1)
    flat_elevation = elevation_grid.reshape(-1)

    # TE basis is horizontal and perpendicular to the propagation plane.
    te_hat = np.stack(
        (
            -np.cos(flat_azimuth),
            np.sin(flat_azimuth),
            np.zeros_like(flat_azimuth),
        ),
        axis=1,
    )

    tm_incident_hat = np.cross(te_hat, downward_directions)
    tm_reflected_hat = np.cross(te_hat, upward_directions)

    incident_te = np.sum(incident_field * te_hat, axis=1)
    incident_tm = np.sum(incident_field * tm_incident_hat, axis=1)

    gamma_te, gamma_tm = fresnel_coefficients(
        flat_elevation, frequency_mhz
    )

    reflected_field = (
        gamma_te[:, None] * incident_te[:, None] * te_hat
        + gamma_tm[:, None] * incident_tm[:, None] * tm_reflected_hat
    )

    total_field = direct_field + reflected_field
    power = np.sum(np.abs(total_field) ** 2, axis=1).reshape(
        len(elevations_deg), len(azimuths_deg)
    )

    relative_db = 10.0 * np.log10(np.maximum(power / np.max(power), 1e-12))

    return {
        "center_ft": center_ft,
        "frequency_mhz": frequency_mhz,
        "elevations_deg": np.asarray(elevations_deg),
        "azimuths_deg": np.asarray(azimuths_deg),
        "relative_db": relative_db,
        "power": power,
        "geometry": geometry,
    }


def nearest_index(values: np.ndarray, target: float) -> int:
    return int(np.argmin(np.abs(np.asarray(values) - target)))


def canonical_argmax(
    values: np.ndarray,
    tolerance: float = 1e-9,
) -> tuple[int, ...]:
    """Return the first maximum, treating floating-point mirror lobes as tied."""
    array = np.asarray(values)
    candidates = np.argwhere(array >= np.max(array) - tolerance)
    return tuple(int(index) for index in candidates[0])


def compass_label(azimuth_deg: float) -> str:
    labels = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    return labels[int((azimuth_deg + 22.5) // 45.0) % 8]


def pattern_metrics(pattern: dict[str, Any]) -> dict[str, float | str]:
    relative_db = pattern["relative_db"]
    elevations = pattern["elevations_deg"]
    azimuths = pattern["azimuths_deg"]

    peak_index = canonical_argmax(relative_db)

    low_rows = np.where(elevations <= 30.0)[0]
    low_subset = relative_db[low_rows, :]
    low_local = canonical_argmax(low_subset)
    low_index = (low_rows[low_local[0]], low_local[1])

    elevation_15_index = nearest_index(elevations, 15.0)
    broadside_index = nearest_index(azimuths, 0.0)
    wire_index = nearest_index(azimuths, 90.0)
    zenith_index = nearest_index(elevations, 90.0)

    best_15_az_index = canonical_argmax(
        relative_db[elevation_15_index, :]
    )[0]

    peak_azimuth = float(azimuths[peak_index[1]])
    low_peak_azimuth = float(azimuths[low_index[1]])
    best_15_azimuth = float(azimuths[best_15_az_index])

    return {
        "peak_elevation_deg": float(elevations[peak_index[0]]),
        "peak_azimuth_deg": peak_azimuth,
        "peak_bearing": compass_label(peak_azimuth),
        "low_angle_peak_elevation_deg": float(elevations[low_index[0]]),
        "low_angle_peak_azimuth_deg": low_peak_azimuth,
        "low_angle_peak_bearing": compass_label(low_peak_azimuth),
        "low_angle_peak_relative_db": float(relative_db[low_index]),
        "broadside_15deg_relative_db": float(
            relative_db[elevation_15_index, broadside_index]
        ),
        "best_15deg_relative_db": float(
            relative_db[elevation_15_index, best_15_az_index]
        ),
        "best_15deg_azimuth_deg": best_15_azimuth,
        "best_15deg_bearing": compass_label(best_15_azimuth),
        "wire_axis_15deg_relative_db": float(
            relative_db[elevation_15_index, wire_index]
        ),
        "zenith_relative_db": float(
            np.max(relative_db[zenith_index, :])
        ),
    }


def validate_integrator() -> float:
    """
    Compare numerical integration to the closed-form straight thin-dipole
    pattern for lengths spanning this model. Returns maximum normalized
    field-amplitude error.
    """
    max_error = 0.0
    observation_angle = np.radians(np.linspace(0.5, 179.5, 360))
    directions = np.stack(
        (
            np.cos(observation_angle),
            np.zeros_like(observation_angle),
            np.sin(observation_angle),
        ),
        axis=1,
    )

    for total_length_lambda in (0.42, 0.83, 1.07, 1.24, 1.47, 1.65):
        k = 2.0 * math.pi
        half_length = total_length_lambda / 2.0
        nodes, weights = np.polynomial.legendre.leggauss(400)
        x = nodes * half_length
        w = weights * half_length

        current = np.sin(k * (half_length - np.abs(x)))
        positions = np.stack(
            (x, np.zeros_like(x), np.zeros_like(x)), axis=1
        )
        weighted_currents = np.stack(
            (current * w, np.zeros_like(x), np.zeros_like(x)), axis=1
        )

        numerical_vector = free_space_far_field(
            positions, weighted_currents, k, directions
        )
        numerical = np.sqrt(
            np.sum(np.abs(numerical_vector) ** 2, axis=1)
        )

        analytical = np.abs(
            (
                np.cos(k * half_length * np.cos(observation_angle))
                - np.cos(k * half_length)
            )
            / np.sin(observation_angle)
        )

        numerical /= np.max(numerical)
        analytical /= np.max(analytical)
        max_error = max(
            max_error,
            float(np.max(np.abs(numerical - analytical))),
        )

    return max_error


def plot_sky_view(
    pattern: dict[str, Any],
    band: str,
    output_path: Path,
) -> None:
    """Sky-view heatmap: center is zenith, outer rim is horizon."""
    azimuth_step = float(np.diff(pattern["azimuths_deg"][:2])[0])
    theta_edges = np.radians(
        np.arange(
            -azimuth_step / 2.0,
            360.0 + azimuth_step / 2.0,
            azimuth_step,
        )
    )
    radial_edges = np.arange(0.0, 91.0, 1.0)

    data = np.clip(pattern["relative_db"][::-1, :], DB_FLOOR, 0.0)

    fig = plt.figure(figsize=(6.2, 5.4))
    ax = fig.add_subplot(111, projection="polar")
    ax.grid(False)

    mesh = ax.pcolormesh(
        theta_edges,
        radial_edges,
        data,
        shading="flat",
        vmin=DB_FLOOR,
        vmax=0.0,
    )

    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_xticks(np.radians((0, 90, 180, 270)))
    ax.set_xticklabels(("N", "E", "S", "W"))
    ax.set_ylim(0, 90)
    ax.set_yticks((0, 30, 60, 90))
    ax.set_yticklabels(("90 deg", "60 deg", "30 deg", "0 deg"))
    ax.set_rlabel_position(225)
    ax.grid(True)

    ax.set_title(
        f"{band} - {pattern['frequency_mhz']:.2f} MHz - "
        f"{pattern['center_ft']:.0f} ft center\n"
        "Sky view: wire E-W; 0 dB is this configuration's peak",
        pad=18,
    )

    colorbar = fig.colorbar(mesh, ax=ax, pad=0.11, shrink=0.78)
    colorbar.set_label("Relative field power (dB)")

    save_pdf_plot(fig, output_path)
    plt.close(fig)


def plot_elevation_cut(
    pattern_20: dict[str, Any],
    pattern_30: dict[str, Any],
    band: str,
    output_path: Path,
) -> None:
    """North broadside elevation cuts, each referenced to overall peak."""
    azimuth_index_20 = nearest_index(pattern_20["azimuths_deg"], 0.0)
    azimuth_index_30 = nearest_index(pattern_30["azimuths_deg"], 0.0)

    fig = plt.figure(figsize=(6.2, 3.2))
    ax = fig.add_subplot(111)

    ax.plot(
        pattern_20["elevations_deg"],
        np.maximum(
            pattern_20["relative_db"][:, azimuth_index_20],
            DB_FLOOR,
        ),
        label="20 ft center",
    )
    ax.plot(
        pattern_30["elevations_deg"],
        np.maximum(
            pattern_30["relative_db"][:, azimuth_index_30],
            DB_FLOOR,
        ),
        label="30 ft center",
    )

    ax.set_xlim(0, 90)
    ax.set_ylim(DB_FLOOR, 0)
    ax.set_xlabel("Elevation angle (degrees)")
    ax.set_ylabel("Relative field power (dB)")
    ax.set_title(f"{band}: broadside elevation cut (north/south)")
    ax.grid(True)
    ax.legend()
    fig.tight_layout()
    save_pdf_plot(fig, output_path)
    plt.close(fig)


def plot_azimuth_cut(
    pattern_20: dict[str, Any],
    pattern_30: dict[str, Any],
    band: str,
    output_path: Path,
    elevation_deg: float = 15.0,
) -> None:
    """Azimuth cuts at a selected low elevation."""
    elevation_index_20 = nearest_index(
        pattern_20["elevations_deg"], elevation_deg
    )
    elevation_index_30 = nearest_index(
        pattern_30["elevations_deg"], elevation_deg
    )

    theta = np.radians(pattern_20["azimuths_deg"])
    theta_closed = np.append(theta, theta[0])

    cut_20 = np.maximum(
        pattern_20["relative_db"][elevation_index_20, :],
        DB_FLOOR,
    )
    cut_30 = np.maximum(
        pattern_30["relative_db"][elevation_index_30, :],
        DB_FLOOR,
    )

    # Convert dB to a positive polar radius: center = -30 dB, rim = 0 dB.
    radius_20 = np.append(cut_20 - DB_FLOOR, cut_20[0] - DB_FLOOR)
    radius_30 = np.append(cut_30 - DB_FLOOR, cut_30[0] - DB_FLOOR)

    fig = plt.figure(figsize=(6.2, 3.7))
    ax = fig.add_subplot(111, projection="polar")

    ax.plot(theta_closed, radius_20, label="20 ft center")
    ax.plot(theta_closed, radius_30, label="30 ft center")

    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_xticks(np.radians((0, 45, 90, 135, 180, 225, 270, 315)))
    ax.set_xticklabels(("N", "NE", "E", "SE", "S", "SW", "W", "NW"))
    ax.set_ylim(0, -DB_FLOOR)
    ax.set_yticks((0, 10, 20, 30))
    ax.set_yticklabels(("-30", "-20", "-10", "0 dB"))
    ax.set_rlabel_position(225)
    ax.set_title(
        f"{band}: azimuth cut at {elevation_deg:.0f} deg elevation\n"
        "Wire axis E-W; broadside N-S",
        pad=16,
    )
    ax.grid(True)
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.18))

    save_pdf_plot(fig, output_path)
    plt.close(fig)


def plot_geometry(output_path: Path) -> None:
    """Draw the common 120 degree geometry at both center heights."""
    beta_rad = math.radians((180.0 - APEX_DEG) / 2.0)
    horizontal_ft = LEG_FT * math.cos(beta_rad)
    drop_ft = LEG_FT * math.sin(beta_rad)

    fig = plt.figure(figsize=(7.2, 4.5))
    ax = fig.add_subplot(111)

    ax.axhline(0.0)
    for center_ft in CENTER_HEIGHTS_FT:
        end_ft = center_ft - drop_ft
        x = (-horizontal_ft, 0.0, horizontal_ft)
        y = (end_ft, center_ft, end_ft)
        ax.plot(x, y, marker="o", label=f"{center_ft:.0f} ft center")
        ax.annotate(
            f"center {center_ft:.0f} ft",
            (0.0, center_ft),
            xytext=(4, 8),
            textcoords="offset points",
        )
        ax.annotate(
            f"ends {end_ft:.1f} ft",
            (horizontal_ft, end_ft),
            xytext=(4, -14),
            textcoords="offset points",
        )

    ax.set_xlim(-32, 32)
    ax.set_ylim(-1, 34)
    ax.set_xlabel("Horizontal distance from center (ft)")
    ax.set_ylabel("Height above ground (ft)")
    ax.set_title(
        "Modeled geometry: 29 ft legs, 120 deg included apex angle\n"
        f"Projected span {2.0 * horizontal_ft:.1f} ft"
    )
    ax.grid(True)
    ax.legend()
    fig.tight_layout()
    save_pdf_plot(fig, output_path)
    plt.close(fig)


def add_wrapped_text(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y_top: float,
    width: float,
    font_size: float = 10.0,
    leading: float | None = None,
    bold: bool = False,
) -> float:
    """Draw wrapped ReportLab Paragraph text and return its bottom y."""
    if leading is None:
        leading = font_size * 1.28
    style = ParagraphStyle(
        name="body",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=font_size,
        leading=leading,
        textColor=colors.black,
        alignment=TA_LEFT,
        spaceAfter=0,
        spaceBefore=0,
    )
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, 1000)
    paragraph.drawOn(pdf, x, y_top - height)
    return y_top - height


def draw_page_header(
    pdf: canvas.Canvas,
    title: str,
    subtitle: str | None = None,
) -> None:
    page_width, page_height = landscape(letter)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(0.38 * inch, page_height - 0.40 * inch, title)
    if subtitle:
        pdf.setFont("Helvetica", 9.5)
        pdf.drawRightString(
            page_width - 0.38 * inch,
            page_height - 0.38 * inch,
            subtitle,
        )
    pdf.setLineWidth(0.5)
    pdf.line(
        0.38 * inch,
        page_height - 0.52 * inch,
        page_width - 0.38 * inch,
        page_height - 0.52 * inch,
    )


def draw_page_number(pdf: canvas.Canvas, page_number: int) -> None:
    page_width, _ = landscape(letter)
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(
        page_width - 0.36 * inch,
        0.20 * inch,
        str(page_number),
    )


def per_band_note(
    band: str,
    metrics_20: dict[str, Any],
    metrics_30: dict[str, Any],
) -> str:
    if band == "40m":
        improvement = (
            metrics_30["best_15deg_relative_db"]
            - metrics_20["best_15deg_relative_db"]
        )
        return (
            "Both installations are dominated by a zenith lobe: this is an "
            "NVIS/regional pattern. Raising the center from 20 to 30 ft improves "
            f"the best 15 deg radiation by only about {improvement:.1f} dB."
        )
    if band == "20m":
        improvement = (
            metrics_30["best_15deg_relative_db"]
            - metrics_20["best_15deg_relative_db"]
        )
        return (
            "At 20 ft the strongest lobe remains vertical. At 30 ft the main "
            f"broadside lobe moves to about {metrics_30['peak_elevation_deg']:.0f} "
            f"deg, and the best 15 deg radiation improves by about {improvement:.1f} dB."
        )
    if band == "17m":
        return (
            f"The 20 ft installation remains high-angle, peaking near "
            f"{metrics_20['peak_elevation_deg']:.0f} deg. At 30 ft the broadside "
            f"main lobe drops to about {metrics_30['peak_elevation_deg']:.0f} deg."
        )
    if band == "15m":
        return (
            "At 30 ft this is the cleanest extended-double-Zepp-like result: "
            f"a broadside main lobe near {metrics_30['peak_elevation_deg']:.0f} deg. "
            "At 20 ft, ground interaction pulls the strongest energy back toward "
            "the zenith."
        )
    if band == "12m":
        return (
            "Additional azimuth lobes are now visible. The 30 ft installation "
            f"still has a broadside main lobe near {metrics_30['peak_elevation_deg']:.0f} "
            "deg, but at 15 deg elevation the best bearings are diagonal rather "
            "than pure broadside."
        )
    return (
        "This band is decisively multi-lobed. At 30 ft, low-angle diagonal lobes "
        f"peak near {metrics_30['low_angle_peak_elevation_deg']:.0f} deg and are "
        f"only {abs(metrics_30['low_angle_peak_relative_db']):.1f} dB below the "
        "overall peak; pure broadside is close to a low-angle null."
    )


def create_overview(
    sky_paths: dict[tuple[int, str], Path],
    output_path: Path,
) -> None:
    """Assemble 12 independently generated charts into one overview image."""
    tile_width = 760
    tile_height = 660
    columns = 4
    rows = 3
    margin = 20
    header_height = 80

    sheet = Image.new(
        "RGB",
        (
            columns * tile_width + (columns + 1) * margin,
            rows * tile_height + (rows + 1) * margin + header_height,
        ),
        "white",
    )
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (margin, 22),
        "58 ft inverted-V doublet - normalized sky-view radiation patterns",
        fill="black",
    )
    draw.text(
        (margin, 48),
        "Within each pair: 20 ft center, then 30 ft center. Center of plot is zenith; rim is horizon.",
        fill="black",
    )

    ordered = []
    for band, _ in BANDS:
        ordered.append((20, band))
        ordered.append((30, band))

    for index, key in enumerate(ordered):
        row = index // columns
        column = index % columns
        x = margin + column * tile_width
        y = header_height + margin + row * tile_height

        with Image.open(sky_paths[key]) as source:
            source = source.convert("RGB")
            source.thumbnail((tile_width, tile_height), Image.Resampling.LANCZOS)
            paste_x = x + (tile_width - source.width) // 2
            paste_y = y + (tile_height - source.height) // 2
            sheet.paste(source, (paste_x, paste_y))

    sheet.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
    sheet.save(output_path, optimize=True)


def create_summary_csv(
    patterns: dict[tuple[int, str], dict[str, Any]],
    metrics: dict[tuple[int, str], dict[str, Any]],
    output_path: Path,
) -> None:
    fieldnames = (
        "height_ft",
        "band",
        "frequency_mhz",
        "total_length_lambda",
        "apex_angle_deg",
        "center_height_ft",
        "end_height_ft",
        "projected_span_ft",
        "peak_elevation_deg",
        "peak_azimuth_deg",
        "peak_bearing",
        "low_angle_peak_elevation_deg",
        "low_angle_peak_azimuth_deg",
        "low_angle_peak_bearing",
        "low_angle_peak_relative_db",
        "broadside_15deg_relative_db",
        "best_15deg_relative_db",
        "best_15deg_azimuth_deg",
        "best_15deg_bearing",
        "wire_axis_15deg_relative_db",
        "zenith_relative_db",
    )

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()

        for center_ft in CENTER_HEIGHTS_FT:
            for band, frequency_mhz in BANDS:
                pattern = patterns[(int(center_ft), band)]
                row_metrics = metrics[(int(center_ft), band)]
                wavelength_m = C / (frequency_mhz * 1e6)
                geometry = pattern["geometry"]

                row = {
                    "height_ft": center_ft,
                    "band": band,
                    "frequency_mhz": frequency_mhz,
                    "total_length_lambda": TOTAL_WIRE_FT * FT / wavelength_m,
                    "apex_angle_deg": APEX_DEG,
                    "center_height_ft": center_ft,
                    "end_height_ft": geometry["end_m"] / FT,
                    "projected_span_ft": 2.0 * geometry["horizontal_m"] / FT,
                    **row_metrics,
                }
                writer.writerow(row)


def create_pdf(
    output_path: Path,
    overview_path: Path,
    geometry_path: Path,
    sky_paths: dict[tuple[int, str], Path],
    elevation_paths: dict[str, Path],
    azimuth_paths: dict[str, Path],
    patterns: dict[tuple[int, str], dict[str, Any]],
    metrics: dict[tuple[int, str], dict[str, Any]],
    validation_error: float,
) -> None:
    page_width, page_height = landscape(letter)
    pdf = canvas.Canvas(str(output_path), pagesize=(page_width, page_height))
    pdf.setTitle("58 ft Doublet Radiation Pattern Model")
    pdf.setAuthor("N1RWJ")

    page_number = 1

    # Page 1: geometry and method
    draw_page_header(
        pdf,
        "58 ft inverted-V doublet: modeled radiation patterns",
        "Analytical thin-wire model - not a full NEC-2 solve",
    )

    pdf.drawImage(
        str(geometry_path),
        0.35 * inch,
        2.42 * inch,
        width=5.45 * inch,
        height=4.85 * inch,
        preserveAspectRatio=True,
        anchor="c",
    )

    x = 5.95 * inch
    y = page_height - 0.82 * inch
    width = 4.68 * inch

    y = add_wrapped_text(
        pdf,
        "<b>Geometry used</b>",
        x,
        y,
        width,
        font_size=11,
    )
    y -= 0.08 * inch
    assumptions = (
        "The user specified a 58 ft wire, 29 ft per leg, an apex wider than "
        "90 degrees, and ends above 5 ft. A 120 degree included apex angle "
        "is used for both cases. This is essentially the minimum common "
        "symmetric geometry that keeps the ends above 5 ft with a 20 ft "
        "center. It yields a 50.2 ft projected span, 5.5 ft ends at the "
        "20 ft center height, and 15.5 ft ends at the 30 ft center height."
    )
    y = add_wrapped_text(pdf, assumptions, x, y, width, font_size=9.5)
    y -= 0.16 * inch

    y = add_wrapped_text(
        pdf,
        "<b>Electrical assumptions</b>",
        x,
        y,
        width,
        font_size=11,
    )
    y -= 0.08 * inch
    method = (
        "The wire is treated as a lossless thin conductor with the usual "
        "sinusoidal standing-current distribution. Its vector far field is "
        "integrated directly. Average ground is represented by complex TE/TM "
        "Fresnel reflection coefficients (relative permittivity 13, conductivity "
        "0.005 S/m). The numerical line-current integrator was checked against "
        "the closed-form straight thin-dipole pattern; maximum normalized field "
        f"amplitude error over the modeled electrical lengths was {validation_error:.2e}."
    )
    y = add_wrapped_text(pdf, method, x, y, width, font_size=9.5)
    y -= 0.16 * inch

    y = add_wrapped_text(
        pdf,
        "<b>Feed system assumption</b>",
        x,
        y,
        width,
        font_size=11,
    )
    y -= 0.08 * inch
    feed = (
        "The 28 ft homebrew balanced line is omitted from the far-field "
        "calculation. With equal and opposite differential currents on conductors "
        "spaced only 14 mm apart, its radiation should be small. The Mix 31 "
        "current choke at the KX2/feedline transition is therefore important: "
        "common-mode current would make the vertical feedline part of the antenna "
        "and could rotate or fill pattern nulls."
    )
    y = add_wrapped_text(pdf, feed, x, y, width, font_size=9.5)
    y -= 0.16 * inch

    y = add_wrapped_text(
        pdf,
        "<b>How to read the plots</b>",
        x,
        y,
        width,
        font_size=11,
    )
    y -= 0.08 * inch
    reading = (
        "Every pattern is normalized to its own strongest direction: 0 dB is "
        "the peak for that height and band. The plots show shape, bearing, and "
        "takeoff angle, not realized gain. The modeled wire runs east-west, so "
        "north-south is broadside. Rotate all compass bearings to match the "
        "actual deployed wire."
    )
    add_wrapped_text(pdf, reading, x, y, width, font_size=9.5)

    draw_page_number(pdf, page_number)
    pdf.showPage()
    page_number += 1

    # Page 2: summary table
    draw_page_header(
        pdf,
        "Pattern summary",
        "Frequencies selected in the lower CW portions of each band",
    )

    table_data = [
        [
            "Band",
            "L / lambda",
            "20 ft center",
            "30 ft center",
            "Practical reading",
        ]
    ]

    summary_notes = {
        "40m": "High-angle/NVIS at both heights.",
        "20m": "30 ft produces a distinct mid-angle broadside lobe.",
        "17m": "30 ft is substantially better for lower-angle broadside work.",
        "15m": "30 ft gives the cleanest broadside EDZ-like pattern.",
        "12m": "Extra lobes begin; low-angle diagonals become important.",
        "10m": "Strongly multi-lobed; diagonal low-angle lobes dominate DX bearings.",
    }

    for band, frequency_mhz in BANDS:
        wavelength_m = C / (frequency_mhz * 1e6)
        electrical_length = TOTAL_WIRE_FT * FT / wavelength_m
        m20 = metrics[(20, band)]
        m30 = metrics[(30, band)]

        text_20 = (
            f"Peak {m20['peak_elevation_deg']:.0f} deg "
            f"{m20['peak_bearing']}; best 15 deg "
            f"{m20['best_15deg_relative_db']:.1f} dB "
            f"{m20['best_15deg_bearing']}"
        )
        text_30 = (
            f"Peak {m30['peak_elevation_deg']:.0f} deg "
            f"{m30['peak_bearing']}; best 15 deg "
            f"{m30['best_15deg_relative_db']:.1f} dB "
            f"{m30['best_15deg_bearing']}"
        )

        table_data.append(
            [
                f"{band}\n{frequency_mhz:.2f} MHz",
                f"{electrical_length:.2f}",
                text_20,
                text_30,
                summary_notes[band],
            ]
        )

    table = Table(
        table_data,
        colWidths=(
            0.95 * inch,
            0.72 * inch,
            2.28 * inch,
            2.28 * inch,
            3.25 * inch,
        ),
        rowHeights=(0.48 * inch,) + (0.83 * inch,) * 6,
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 8.2),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 1), (1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    table.wrapOn(pdf, page_width - 0.7 * inch, page_height)
    table.drawOn(pdf, 0.35 * inch, 1.60 * inch)

    add_wrapped_text(
        pdf,
        "<b>Interpretation:</b> the 15 degree figures are relative to the "
        "overall peak for that same configuration, not relative to the best "
        "direction within the 15 degree cut. Symmetry creates equivalent mirror "
        "lobes, so a single compass label in the table represents a family of "
        "equivalent bearings.",
        0.45 * inch,
        1.35 * inch,
        page_width - 0.90 * inch,
        font_size=9.2,
    )

    draw_page_number(pdf, page_number)
    pdf.showPage()
    page_number += 1

    # Pages 3-8: one page per band
    for band, frequency_mhz in BANDS:
        wavelength_m = C / (frequency_mhz * 1e6)
        electrical_length = TOTAL_WIRE_FT * FT / wavelength_m

        draw_page_header(
            pdf,
            f"{band} pattern - {frequency_mhz:.2f} MHz",
            f"58 ft total = {electrical_length:.2f} wavelengths",
        )

        pdf.setFont("Helvetica", 8.5)
        pdf.drawString(
            0.40 * inch,
            page_height - 0.70 * inch,
            "Sky views: center = zenith, rim = horizon. "
            "All scales are dB relative to that configuration's own peak.",
        )

        pdf.drawImage(
            str(sky_paths[(20, band)]),
            0.32 * inch,
            3.55 * inch,
            width=5.10 * inch,
            height=4.15 * inch,
            preserveAspectRatio=True,
            anchor="c",
        )
        pdf.drawImage(
            str(sky_paths[(30, band)]),
            5.57 * inch,
            3.55 * inch,
            width=5.10 * inch,
            height=4.15 * inch,
            preserveAspectRatio=True,
            anchor="c",
        )

        pdf.drawImage(
            str(elevation_paths[band]),
            0.38 * inch,
            0.72 * inch,
            width=5.00 * inch,
            height=2.72 * inch,
            preserveAspectRatio=True,
            anchor="c",
        )
        pdf.drawImage(
            str(azimuth_paths[band]),
            5.62 * inch,
            0.72 * inch,
            width=5.00 * inch,
            height=2.72 * inch,
            preserveAspectRatio=True,
            anchor="c",
        )

        note = per_band_note(
            band,
            metrics[(20, band)],
            metrics[(30, band)],
        )
        add_wrapped_text(
            pdf,
            f"<b>Result:</b> {note}",
            0.50 * inch,
            0.67 * inch,
            page_width - 1.00 * inch,
            font_size=8.4,
            leading=10.2,
        )

        draw_page_number(pdf, page_number)
        pdf.showPage()
        page_number += 1

    # Final page: deployment conclusions
    draw_page_header(
        pdf,
        "What this means for deployment",
        "Pattern conclusions and model limits",
    )

    pdf.drawImage(
        str(overview_path),
        0.35 * inch,
        0.55 * inch,
        width=6.45 * inch,
        height=6.95 * inch,
        preserveAspectRatio=True,
        anchor="c",
    )

    x = 6.95 * inch
    y = page_height - 0.90 * inch
    width = 3.65 * inch

    conclusions = (
        "<b>40 m:</b> Both heights are primarily high-angle. The extra 10 ft "
        "does not turn this into a low-angle DX antenna.<br/><br/>"
        "<b>20/17/15 m:</b> The 30 ft center is materially better. Main broadside "
        "lobes are approximately 41, 34, and 33 degrees respectively. At 20 ft, "
        "ground interaction keeps the strongest radiation much higher.<br/><br/>"
        "<b>12 m:</b> The antenna is now about 1.47 wavelengths long. It remains "
        "usable, but azimuth lobes are developing and low-angle best bearings "
        "are no longer simply broadside.<br/><br/>"
        "<b>10 m:</b> Expect four useful diagonal low-angle lobes rather than a "
        "classic two-lobe dipole pattern. With the wire east-west, those lobes "
        "are approximately toward the northeast, southeast, southwest, and "
        "northwest.<br/><br/>"
        "<b>Feedline:</b> The pattern assumes the two-wire line remains balanced. "
        "If the Mix 31 choke is ineffective at a particular band, or the two legs "
        "are deployed asymmetrically, common-mode current can substantially alter "
        "the result.<br/><br/>"
        "<b>Uncertainty:</b> Real soil, sloping terrain, nearby trees, wire sag, "
        "and endpoint placement can move peak angles by several degrees and fill "
        "deep nulls. The broad pattern transitions are more trustworthy than the "
        "exact depth of any narrow null."
    )
    add_wrapped_text(
        pdf,
        conclusions,
        x,
        y,
        width,
        font_size=9.3,
        leading=12.0,
    )

    draw_page_number(pdf, page_number)
    pdf.save()


def generate_all(output_directory: Path) -> None:
    output_directory.mkdir(parents=True, exist_ok=True)

    pdf_path = output_directory / "58ft_doublet_radiation_patterns.pdf"
    overview_path = output_directory / "58ft_doublet_pattern_overview.png"
    csv_path = output_directory / "58ft_doublet_model_summary.csv"

    validation_error = validate_integrator()

    patterns: dict[tuple[int, str], dict[str, Any]] = {}
    metrics: dict[tuple[int, str], dict[str, Any]] = {}

    for center_ft in CENTER_HEIGHTS_FT:
        for band, frequency_mhz in BANDS:
            key = (int(center_ft), band)
            patterns[key] = calculate_pattern(center_ft, frequency_mhz)
            metrics[key] = pattern_metrics(patterns[key])

    with tempfile.TemporaryDirectory(prefix="doublet_model_") as temp_name:
        temp_directory = Path(temp_name)
        sky_paths: dict[tuple[int, str], Path] = {}
        elevation_paths: dict[str, Path] = {}
        azimuth_paths: dict[str, Path] = {}

        geometry_path = temp_directory / "geometry.jpg"
        plot_geometry(geometry_path)

        for band, _ in BANDS:
            for center_ft in CENTER_HEIGHTS_FT:
                key = (int(center_ft), band)
                path = temp_directory / f"{band}_{int(center_ft)}ft_sky.jpg"
                plot_sky_view(patterns[key], band, path)
                sky_paths[key] = path

            elevation_path = temp_directory / f"{band}_elevation.jpg"
            azimuth_path = temp_directory / f"{band}_azimuth.jpg"

            plot_elevation_cut(
                patterns[(20, band)],
                patterns[(30, band)],
                band,
                elevation_path,
            )
            plot_azimuth_cut(
                patterns[(20, band)],
                patterns[(30, band)],
                band,
                azimuth_path,
            )

            elevation_paths[band] = elevation_path
            azimuth_paths[band] = azimuth_path

        create_overview(sky_paths, overview_path)
        overview_pdf_path = temp_directory / "overview.jpg"
        with Image.open(overview_path) as overview:
            overview.convert("RGB").save(
                overview_pdf_path,
                quality=70,
                optimize=True,
            )
        create_summary_csv(patterns, metrics, csv_path)
        create_pdf(
            pdf_path,
            overview_pdf_path,
            geometry_path,
            sky_paths,
            elevation_paths,
            azimuth_paths,
            patterns,
            metrics,
            validation_error,
        )

    print(f"Integrator validation error: {validation_error:.3e}")
    print(pdf_path)
    print(overview_path)
    print(csv_path)


def main() -> None:
    output_directory = (
        Path(sys.argv[1]).expanduser().resolve()
        if len(sys.argv) > 1
        else Path.cwd()
    )
    generate_all(output_directory)


if __name__ == "__main__":
    main()
