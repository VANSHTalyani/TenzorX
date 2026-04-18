"""Train an XGBoost propensity model on synthetic data.

Run once after first boot:
    docker compose exec backend python scripts/train_risk_model.py

The model file is loaded by `HybridRiskScorer` if present; otherwise the
scorer falls back to the rules-only path.
"""
from __future__ import annotations

import json
import os
import random
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split


FEATURES = [
    "cibil_score",
    "active_loans",
    "total_outstanding",
    "overdue_count",
    "inquiries_last_6m",
    "oldest_account_months",
    "monthly_income",
    "loan_amount_requested",
    "tenure_months_requested",
    "existing_emi_total",
    "is_salaried",
]


def synth(n: int = 20_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(
        {
            "cibil_score": rng.integers(550, 850, n),
            "active_loans": rng.integers(0, 6, n),
            "total_outstanding": rng.uniform(0, 500_000, n),
            "overdue_count": rng.integers(0, 5, n),
            "inquiries_last_6m": rng.integers(0, 12, n),
            "oldest_account_months": rng.integers(1, 240, n),
            "monthly_income": rng.uniform(15_000, 250_000, n),
            "loan_amount_requested": rng.uniform(50_000, 2_500_000, n),
            "tenure_months_requested": rng.integers(6, 60, n),
            "existing_emi_total": rng.uniform(0, 80_000, n),
            "is_salaried": rng.integers(0, 2, n),
        }
    )
    foir = (df["loan_amount_requested"] / df["tenure_months_requested"] + df["existing_emi_total"]) / df["monthly_income"]
    z = (
        (df["cibil_score"] - 600) / 250 * 2.5
        - df["overdue_count"] * 0.6
        - (df["inquiries_last_6m"] > 5).astype(int) * 0.4
        + df["is_salaried"] * 0.3
        - foir.clip(0, 2) * 1.8
        + rng.normal(0, 0.5, n)
    )
    p_good = 1 / (1 + np.exp(-z))
    df["good_outcome"] = (rng.uniform(0, 1, n) < p_good).astype(int)
    return df


def main() -> None:
    out_dir = Path("data/models")
    out_dir.mkdir(parents=True, exist_ok=True)

    df = synth()
    X = df[FEATURES].values
    y = df["good_outcome"].values
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=7)

    dtrain = xgb.DMatrix(X_tr, label=y_tr, feature_names=FEATURES)
    dtest = xgb.DMatrix(X_te, label=y_te, feature_names=FEATURES)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "max_depth": 5,
        "eta": 0.1,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
    }
    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=300,
        evals=[(dtest, "test")],
        early_stopping_rounds=20,
        verbose_eval=50,
    )

    auc = roc_auc_score(y_te, booster.predict(dtest))
    print(f"Test AUC: {auc:.4f}")

    booster.save_model(str(out_dir / "risk_xgb.json"))
    with open(out_dir / "risk_features.json", "w", encoding="utf-8") as fh:
        json.dump(FEATURES, fh)
    print(f"Saved model + features to {out_dir.resolve()}")


if __name__ == "__main__":
    random.seed(42)
    main()
