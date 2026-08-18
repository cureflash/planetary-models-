from __future__ import annotations

import csv
import io
import time
import urllib.error
import urllib.parse
import urllib.request

TAP_URLS = [
    "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync",
    "https://tapvizier.u-strasbg.fr/TAPVizieR/tap/sync",
    "https://tapvizier.iucaa.in/TAPVizieR/tap/sync",
]
USER_AGENT = "planetary-models-educational-site/1.0"


def query(adql: str) -> list[dict[str, str]]:
    params = {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": adql}
    errors: list[str] = []
    for base in TAP_URLS:
        for method in ("POST", "GET"):
            for attempt in range(2):
                try:
                    if method == "POST":
                        req = urllib.request.Request(
                            base,
                            data=urllib.parse.urlencode(params).encode(),
                            headers={"User-Agent": USER_AGENT},
                        )
                    else:
                        req = urllib.request.Request(
                            base + "?" + urllib.parse.urlencode(params),
                            headers={"User-Agent": USER_AGENT},
                        )
                    with urllib.request.urlopen(req, timeout=120) as response:
                        text = response.read().decode("utf-8", errors="replace")
                    print(f"TAP success: {base} {method}")
                    return list(csv.DictReader(io.StringIO(text)))
                except Exception as exc:
                    detail = f"{base} {method} attempt {attempt + 1}: {exc}"
                    if isinstance(exc, urllib.error.HTTPError):
                        try:
                            detail += " body=" + repr(exc.read().decode("utf-8", errors="replace")[:600])
                        except Exception:
                            pass
                    print("TAP failed:", detail)
                    errors.append(detail)
                    time.sleep(2)
    raise RuntimeError("All VizieR TAP endpoints failed:\n" + "\n".join(errors))


def quote_table(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def main() -> None:
    searches = [
        ("catalog id", "SELECT TOP 50 table_name, description FROM TAP_SCHEMA.tables WHERE table_name LIKE '%256%' ORDER BY table_name"),
        ("Carlsberg description", "SELECT TOP 50 table_name, description FROM TAP_SCHEMA.tables WHERE 1=ivo_hasword(description, 'Carlsberg') ORDER BY table_name"),
        ("Meridian description", "SELECT TOP 100 table_name, description FROM TAP_SCHEMA.tables WHERE 1=ivo_hasword(description, 'Meridian') ORDER BY table_name"),
    ]
    found: dict[str, dict[str, str]] = {}
    for label, adql in searches:
        print(f"\n### table search: {label}")
        try:
            rows = query(adql)
        except Exception as exc:
            print(f"search failed: {exc}")
            continue
        for row in rows:
            print(row)
            text = ((row.get("description") or "") + " " + (row.get("table_name") or "")).casefold()
            if "carlsberg" in text or "i/256" in text or "1256" in text:
                found[row["table_name"]] = row

    print("\nCandidate Carlsberg tables:")
    for row in found.values():
        print(row)

    if not found:
        raise RuntimeError("Could not discover Carlsberg I/256 tables in TAP_SCHEMA")

    for name in found:
        print(f"\n=== {name} columns ===")
        escaped = name.replace("'", "''")
        cols = query(
            "SELECT column_name, datatype, unit, description FROM TAP_SCHEMA.columns "
            f"WHERE table_name='{escaped}' ORDER BY column_index"
        )
        for col in cols:
            print(col)
        print(f"\n=== {name} sample ===")
        for sample in query(f"SELECT TOP 8 * FROM {quote_table(name)}"):
            print(sample)


if __name__ == "__main__":
    main()
