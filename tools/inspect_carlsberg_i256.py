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
    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "csv",
        "QUERY": adql,
    }
    errors: list[str] = []
    for base in TAP_URLS:
        for method in ("POST", "GET"):
            for attempt in range(2):
                try:
                    if method == "POST":
                        payload = urllib.parse.urlencode(params).encode()
                        req = urllib.request.Request(base, data=payload, headers={"User-Agent": USER_AGENT})
                    else:
                        url = base + "?" + urllib.parse.urlencode(params)
                        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(req, timeout=120) as response:
                        text = response.read().decode("utf-8", errors="replace")
                    print(f"TAP success: {base} {method}")
                    return list(csv.DictReader(io.StringIO(text)))
                except Exception as exc:
                    detail = f"{base} {method} attempt {attempt + 1}: {exc}"
                    if isinstance(exc, urllib.error.HTTPError):
                        try:
                            body = exc.read().decode("utf-8", errors="replace")[:600]
                            detail += f" body={body!r}"
                        except Exception:
                            pass
                    print("TAP failed:", detail)
                    errors.append(detail)
                    time.sleep(2)
    raise RuntimeError("All VizieR TAP endpoints failed:\n" + "\n".join(errors))


def main() -> None:
    tables = query(
        "SELECT table_name, description FROM TAP_SCHEMA.tables "
        "WHERE table_name LIKE 'I/256%' ORDER BY table_name"
    )
    print("I/256 tables:")
    for row in tables:
        print(row)

    for row in tables:
        name = row["table_name"]
        print(f"\n=== {name} columns ===")
        cols = query(
            "SELECT column_name, datatype, unit, description FROM TAP_SCHEMA.columns "
            f"WHERE table_name='{name}' ORDER BY column_index"
        )
        for col in cols:
            print(col)
        print(f"\n=== {name} sample ===")
        safe = '"' + name.replace('"', '""') + '"'
        samples = query(f"SELECT TOP 5 * FROM {safe}")
        for sample in samples:
            print(sample)


if __name__ == "__main__":
    main()
