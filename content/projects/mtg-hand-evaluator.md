---
title: "MTG Hand Evaluator: ML Model Comparison on Opening Hands"
date: 2026-03-20
author: "Matt Jacob"
description: "Predicting opening hand win rates in Magic: The Gathering Limited using five ML models — from logistic regression to card embeddings — with an interactive Streamlit dashboard."
tags: ["machine learning", "deep learning", "PyTorch", "scikit-learn", "XGBoost"]
draft: false
---

**Goal**: Compare multiple ML approaches on a single tabular prediction task — predicting whether a 7-card opening hand in MTG Limited will lead to a win — and present results in an interactive Streamlit UI.

**Data**: Card-level and game-level statistics from [17lands.com](https://www.17lands.com/), the largest community dataset for MTG Arena draft data.

**Code**: [github.com/donq-t/mtg-hand-evaluator](https://github.com/donq-t/mtg-hand-evaluator)

---

## The Problem

In Magic: The Gathering Limited (Draft), you start each game by drawing 7 cards. The quality of this opening hand — land count, card quality, mana curve, color consistency — has a measurable effect on win rate. Can we quantify that effect and predict outcomes from the hand alone?

The input is a 7-card hand. The output is $P(\text{win})$.

---

## Feature Engineering

Each hand is transformed into a 16-dimensional feature vector:

| Feature | Description |
|---|---|
| `num_lands` | Count of lands in hand (0–7) |
| `num_creatures`, `num_spells` | Card type breakdown |
| `avg_gih_wr`, `max_gih_wr`, `min_gih_wr` | Card quality stats (Games In Hand Win Rate from 17lands) |
| `avg_cmc` | Average mana cost of non-land cards |
| `curve_1` through `curve_5plus` | Mana curve distribution |
| `num_colors` | Color diversity |
| `color_consistency` | Fraction of spells castable by lands in hand |
| `on_play` | Play/draw indicator |

The key insight: 17lands publishes per-card win rates (GIH WR), so each card in a hand has a known empirical strength. Aggregating these into hand-level statistics gives the models strong signal.

---

## Models

Five models, ordered by complexity:

### 1. Logistic Regression (baseline)

$$P(\text{win} \mid \mathbf{x}) = \sigma(\mathbf{w}^T \mathbf{x} + b)$$

A linear model — the weighted sum of features passed through a sigmoid. Fast and interpretable. The coefficients directly tell you which features matter and in which direction.

### 2. Random Forest

An ensemble of 200 decision trees that vote on the outcome. Handles non-linear relationships and feature interactions naturally. Provides feature importance via impurity reduction.

### 3. XGBoost (Gradient Boosting)

Builds trees sequentially, where each new tree corrects the residual errors of the ensemble so far. State of the art for tabular data. Typically the strongest model for structured prediction tasks.

### 4. Neural Network (MLP)

A 3-layer multi-layer perceptron ($128 \to 64 \to 32$) with ReLU activations, batch normalization, and dropout. Trained with Adam and early stopping. The deep learning entry point — learns non-linear feature representations through backpropagation.

### 5. Card Embedding Model (stretch goal)

Instead of hand-crafted features, this model learns a dense vector representation (embedding) for each card — similar to word embeddings in NLP. The hand representation is the mean of its 7 card embeddings, passed through a prediction head.

$$\mathbf{h} = \frac{1}{7}\sum_{i=1}^{7} \text{Embed}(c_i), \quad P(\text{win}) = \sigma(f(\mathbf{h}))$$

This can capture card synergies that aggregate statistics miss.

---

## Results

Trained on 50,000 synthetic games (MKM — Murders at Karlov Manor), split 70/15/15:

| Model | AUC | Accuracy | MAE | RMSE | Log Loss |
|---|---|---|---|---|---|
| Logistic Regression | 0.9844 | 0.9908 | 0.0137 | 0.0827 | 0.0243 |
| Random Forest | 0.9891 | 0.9909 | 0.0129 | 0.0785 | 0.0215 |
| XGBoost | 0.9890 | 0.9908 | 0.0113 | 0.0813 | 0.0218 |
| Neural Network | 0.9871 | 0.9908 | 0.0126 | 0.0795 | 0.0219 |
| Card Embeddings | **0.9933** | 0.9903 | **0.0101** | **0.0757** | **0.0170** |

All models comfortably beat the random baseline (0.50 AUC). The Card Embedding model achieved the highest AUC, suggesting that learned card representations capture signal beyond hand-crafted features. Among the feature-engineered models, XGBoost had the lowest MAE.

---

## Key Findings

1. **Card quality dominates** — `avg_gih_wr` (average card win rate) is the most important feature across all models. Drafting good cards matters more than anything else.

2. **Land count sweet spot: 2–3 lands** — Hands with 2–3 lands win most often. 0–1 lands (mana screw) and 5+ lands (mana flood) significantly hurt win rate.

3. **Mana curve matters** — Having plays at 2 and 3 mana is important. Hands full of expensive cards struggle even with enough lands.

4. **Non-linearity helps** — Random Forest and XGBoost outperform Logistic Regression, confirming that feature interactions (e.g., land count $\times$ curve shape) carry real signal.

5. **Embeddings capture more** — The card embedding model outperforms all feature-engineered models, suggesting card-level structure (synergies, archetypes) that aggregate statistics miss.

---

## Interactive Dashboard

The Streamlit app includes four pages:

- **Data Explorer** — Dataset stats, card ratings table with filtering, win rate distributions
- **Model Comparison** — Side-by-side metrics, bar charts, radar plots, training curves
- **Hand Evaluator** — Pick 7 cards, see each model's prediction with card art from Scryfall
- **Insights** — Feature importance heatmaps, partial dependence plots, correlation matrix

Run locally:

```bash
git clone https://github.com/donq-t/mtg-hand-evaluator.git
cd mtg-hand-evaluator
pip install -r requirements.txt
python src/train.py
streamlit run app/Home.py
```

---

## Stack

Python, pandas, scikit-learn, XGBoost, PyTorch, Streamlit, Plotly, 17lands API, Scryfall API
