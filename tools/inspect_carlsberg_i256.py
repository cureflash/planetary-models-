from __future__ import annotations

import csv
import io
import urllib.parse
import urllib.request

TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"


def query(adql: str) -> list[dict[str, str]]:
    payload = urllib.parse.urlencode({
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "csv",
        "QUERY": adql,
    }).encode()
    req = urllib.request.Request(
        TAP_URL,
        data=payload,
        headers={"User-Agent": "planetary-models-educational-site/1.0"},
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        text = response.read().decode("utf-8", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


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
