# Third-party notices

## United States map data

data/states-albers-10m.json is vendored without modification from us-atlas 3.0.1.

- Project: https://github.com/topojson/us-atlas
- Pinned download: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json
- Original geometry: US Census Bureau 2017 cartographic state boundaries.
- Projection: d3.geoAlbersUsa().scale(1300).translate([487.5, 305]), fitting 975 by 610.
- Source checksum: data/source.json

The converter decodes arcs, rounds coordinates to three decimals, removes closing duplicates, normalizes ring winding, and calculates interior anchors. It uniformly fits all retained geometry into 975 by 610 with padding, including Aleutian islands outside the source's nominal viewport. It includes 50 states and DC. Alaska and Hawaii are insets.

The decoder follows https://github.com/topojson/topojson-specification. The converter and interior-point implementation are original code; no D3 or TopoJSON runtime is bundled.

## Upstream ISC license (also in data/us-atlas-LICENSE.txt)

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
