# External readiness gates

N-Pricing keeps the repo-contained pricing platform runnable without bank
systems. External production closure is now tracked as explicit gates instead
of open-ended roadmap text.

Run:

```bash
npm run check:external-readiness
npm run check:external-readiness -- --require-all
```

The default command reports status and exits successfully for local/dev use.
`--require-all` is the production gate: any missing credential, dataset, or
ops flip exits non-zero.

## Gates

| Gate | Required signal |
| --- | --- |
| Salesforce FSC CRM | `ADAPTER_CRM=salesforce` plus `SALESFORCE_INSTANCE_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` |
| Bloomberg market data | `ADAPTER_MARKET_DATA=bloomberg` plus `BLOOMBERG_APP_NAME` |
| BM HOST reconciliation | `ADAPTER_CORE_BANKING=bm-host` plus `BM_HOST_SFTP_HOST`, `BM_HOST_SFTP_USER`, `BM_HOST_SFTP_PRIVATE_KEY_PEM` |
| PUZZLE admission | `ADAPTER_ADMISSION=puzzle` plus `PUZZLE_BASE_URL`, `PUZZLE_CLIENT_ID`, `PUZZLE_CLIENT_SECRET` |
| ALQUID budget | `ADAPTER_BUDGET=alquid` plus `ALQUID_BASE_URL`, `ALQUID_CLIENT_ID`, `ALQUID_CLIENT_SECRET` |
| Historical backtesting | `HISTORICAL_BACKTEST_DATASET_PATH` points to an available bank-approved dataset |
| Production tenancy strict | `TENANCY_ENFORCE=on` and `TENANCY_STRICT=on` |

The adapter code surfaces already exist and fail closed through the registry
bootstrap when a real adapter is requested without credentials. The remaining
work is contract-specific HTTP/SFTP/BLPAPI implementation once a bank provides
the exact endpoint contracts and credentials.
