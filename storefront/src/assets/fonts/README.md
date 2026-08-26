# Fonts

`LiberationSans-Regular.ttf` and `LiberationSans-Bold.ttf`, embedded in the
generated proforma PDFs.

## Why these are committed

The PDF standard's built-in fonts (Helvetica and friends) use WinAnsi encoding,
which has no Polish diacritics — `ą ć ę ł ń ś ź ż` all render as garbage or
disappear. A proforma addressed to *Instalacje PV Kowalski* in *Wrocław* has to
spell both correctly, so a font with full Latin Extended-A coverage must be
embedded in the document.

Liberation Sans is metrically compatible with Arial, which is what an invoice is
expected to look like, and is about half the size of DejaVu Sans.

## Licence

SIL Open Font License 1.1 — redistribution, including embedding in generated
documents, is permitted. Upstream: https://github.com/liberationfonts/liberation-fonts
