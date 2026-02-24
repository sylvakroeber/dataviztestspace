# export_data.R — generate data.csv for tariff-tracker-f1
# -------------------------------------------------------
# Run once whenever the source xlsx is updated.
# Output: tariff-tracker-f1/data.csv

library(readxl)
library(dplyr)
library(readr)

xlsx_path <- "tariff_impacts_results_20260216.xlsx"

# Read sheet F1; skip the title + metadata rows (rows 1-6 in Excel = rows 1-5
# before the header, then the header row itself).
# Row 1  = title string
# Rows 2-5 = blank / metadata
# Row 6  = column headers  ← use as names
# Rows 7-79 = data

raw <- read_excel(
  xlsx_path,
  sheet = "F1",
  skip  = 5,          # skip rows 1-5; row 6 becomes the header
  col_names = TRUE
)

# The header row in the xlsx is descriptive text. Rename to clean identifiers.
# Column order: A=date, B=nominal_m, C=2025_m, D=avg_m
names(raw)[1:4] <- c("date_serial", "customs_nominal_m", "customs_2025_m", "avg_2022_2024_m")

# Drop rows where the date column is empty
raw <- raw |> filter(!is.na(date_serial))

# readxl already converts Excel date cells to POSIXct; cast to Date and convert values.
raw <- raw |>
  mutate(
    date               = as.Date(date_serial),
    # Convert millions -> billions (2 decimal places is sufficient precision)
    customs_nominal_bn = round(as.numeric(customs_nominal_m) / 1000, 2),
    customs_2025_bn    = round(as.numeric(customs_2025_m)    / 1000, 2),
    avg_2022_2024_bn   = round(as.numeric(avg_2022_2024_m)   / 1000, 2),
  )

out <- raw |>
  select(date, customs_nominal_bn, customs_2025_bn, avg_2022_2024_bn)

write_csv(out, "data.csv")

message("Wrote ", nrow(out), " rows to data.csv")
