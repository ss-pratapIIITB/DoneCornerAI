# Ingest / clean

Normalize CSV close files into `facts_pnl`, `facts_cash`, `facts_arr`, and `facts_headcount`.

- Sample pack: call `load_sample_pack`. No sandbox required.
- Uploads: call `upload_close_file`, then clean in the sandbox. USD only. Tag `source=upload`. Do not delete sample rows.
- If `TRUEFORGE_SANDBOX` is off, tell the user to load the sample pack instead.
