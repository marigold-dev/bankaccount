# bankaccount

A PoC to create a decentralized bank account

```
taq compile bank_account.jsligo
taq deploy bank_account.tz -e "testing"
```

```
taq generate types ./demoapp/src
taq generate types ./bankaccountdapp/src
```

```
taq compile bank_account.jsligo --json && mv artifacts/bank_account.json ./bankaccountdapp/src/contractTemplate/
```
