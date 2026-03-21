# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a shipping document workflow repository for 진상옥(JinSangOk) / Easy-Tech. The primary deliverable is a single-file HTML application that generates Commercial Invoice (CI) and Packing List (PL) documents for export shipping.

## Active File

**`Claude Code_ShippingDocs_v4.html`** — the current working file. Always modify this file, never `ShippingDocs_v4 (12).html` (the original baseline kept for reference).

Before starting any new feature session, copy the current file as a new version backup if the change is significant.

## Application Architecture

The app is a single-file HTML (~1,300+ lines) with no build step, no npm, no server. Open directly in a browser.

### Two-tab structure
- **CI tab** (`#ci-panel`): Commercial Invoice form
- **PL tab** (`#pl-panel`): Packing List form — most fields auto-sync from CI

### Data persistence
- All form state is saved to `localStorage` under key `SK = 'SD_CLEAN_1'`
- Master lists (companies, units, etc.) are saved under key `LK = 'SD_LIST_CLEAN_1'`
- `sv()` saves current state; `ld()` loads on page init
- `window.beforeunload` forces a final `sv()` on tab/window close

### Field color convention
| Color | Class | Meaning |
|-------|-------|---------|
| Orange | `.f` | User-editable, manually entered |
| Green | `.fs` | Auto-synced from another field |
| Orange + `.edited` | `.fs.edited` | Was auto-synced but user manually overrode |

In print/PDF, all colors become black (`@media print`).

### CI → PL sync
`SYNC_MAP` defines which PL field mirrors which CI field. `syncPL()` iterates this map and copies values unless the PL field has `element.dataset.m = '1'` (manual override flag).

**focusin rule**: A global `focusin` listener immediately marks any `.fs` input/textarea/select as `dataset.m='1'` (manual) the moment the user clicks into it, preventing sync from overwriting mid-edit.

### CI Notify ← CI Consignee sync
`syncNotify()` mirrors Consignee → Notify Party (name + address) unless Notify has `dataset.m='1'`. The `↺` button calls `notifyReset()` to clear the flag and re-sync. `syncNotify()` is called from `ciChanged()`.

### Company name fields
CI company fields (TO, Shipper, Consignee, Notify) are `<input>` with `<datalist>` for autocomplete — NOT `<select>`. This allows free-text entry. `popDL(inputId, arr, isObj)` populates the datalist options.

PL company name fields are plain `<input class="fs">` (sync from CI). Changing a PL company name (`plNameChanged()`) auto-clears the address field below it. Each PL address textarea has an adjacent `📋 주소 선택...` `<select>` (`.no-print`) that shows all stored company addresses via `populatePLAddrPicker()`.

### Company address auto-fill
`fillAddr(type)` looks up the currently typed company name in `localStorage` lists and fills the address field. If not found, **clears** the address field. Called whenever a company name input changes (`onSel` or `notifyManualSel`).

### Multi-commodity support
`ciComms[]` array holds multiple CI line items (commodity, qty, unit price, packing, origin). `renderCIComms()` rebuilds the CI cargo table body dynamically. The N/M textarea (`#ci-nm`) is created dynamically inside this render — its value must be saved before `tb.innerHTML=''` and restored after.

`plExtraComms[]` holds additional PL commodity rows rendered into `#pl-extra-comms` div.

### N/M textarea auto-resize
Both `#ci-nm` and `#pl-nm` use `autoResize(el)` on `oninput` and on page init. `height:auto` + `el.scrollHeight` pattern — no fixed height cap.

### Excel export
Uses `ExcelJS` (CDN). `buildCIsheet(wb)` and `buildPLsheet(wb)` construct worksheets row-by-row using `sc()` (set cell) and `mr()` (merge range) helpers.

### Modal (관리 / Manage)
Single modal `#modal` handles all list management (companies, ports, units). `curM` holds the current list type being edited. `OBJ` types (to, shipper, consignee, notify) store `{n, a}` objects; others store plain strings.

After closing modal, `closeM()` calls `fillAddr('shipper')`, `fillAddr('consignee')`, and conditionally `fillAddr('notify')` to refresh addresses from updated list data.

## Key Functions Reference

| Function | Purpose |
|----------|---------|
| `sv()` / `ld()` | Save/load all form state to localStorage |
| `ciChanged()` | Called on any CI field change; triggers `syncPL()` + `syncNotify()` + `sv()` |
| `syncPL()` | Copies CI values to non-manual PL fields |
| `syncNotify()` | Copies Consignee → Notify if not manually overridden |
| `fillAddr(type)` | Fills address from stored list; clears if name not found |
| `plNameChanged(inp, addrId)` | Clears address when PL company name changes |
| `renderCIComms()` | Rebuilds CI cargo rows; saves/restores `#ci-nm` value |
| `renderCts()` | Rebuilds container rows in PL |
| `plCalc()` / `ciCalc()` / `ciCalcMulti()` | Recalculate totals |
| `autoResize(el)` | Expands textarea height to fit content |
| `openDP(fid)` / `applyDP(fid)` | Date picker: hidden `<input type="date">` → formatted string |
| `doExcel()` | Export current tab as .xlsx via ExcelJS |
| `doReset()` | Clears localStorage and reloads |

## Workflow Notes

- **No build/compile step.** Edit the HTML file and refresh the browser.
- **Test by opening in Chrome** (iCloud Drive path may require local copy if browser blocks local file access).
- **`ShippingDocs_v4 (12).html`** is the original pre-Claude-Code baseline. Do not modify it.
- **`shipping docs supabase/index.html`** is a separate experimental version with Supabase backend — unrelated to the main app.
- Excel reference layouts are in `CI PL Format Standard.xlsx` and `invoice.xlsx`.
