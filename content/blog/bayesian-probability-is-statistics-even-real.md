---
title: "Bayesian Probability: Is Statistics Even Real?"
date: 2026-02-25
author: "Matt Jacob"
description: "Bayes' theorem answers the questions we actually care about. It also implies something uncomfortable — that probability is just a measure of our ignorance."
tags: ["bayesian", "probability", "statistics", "philosophy"]
draft: false
---

You go to the doctor. You take a test. The test comes back positive. You want to know one thing: *what's the probability I actually have this disease?*

This is the most natural question in the world. And for about a century, the dominant school of statistics refused to answer it.

Frequentist statistics — the framework you learned in your intro stats class, the one with p-values and confidence intervals and null hypotheses — can tell you the probability of getting a positive test result *given that you have the disease*. That's P(positive | disease). It can also tell you the probability of a positive result *given that you're healthy*. That's the false positive rate, P(positive | no disease).

But it cannot — by philosophical design — tell you P(disease | positive). The probability that you're actually sick, given that you just tested positive. The thing you actually wanted to know.

Bayes' theorem can.

## The Inversion

Thomas Bayes, an 18th-century Presbyterian minister, figured out how to flip conditional probabilities. The theorem itself is almost comically simple:

$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

That's it. Multiply the likelihood by the prior, divide by the evidence. In the medical context: take the sensitivity of the test, multiply it by the base rate of the disease in the population, and normalize.

Let's run the numbers on a scenario that genuinely surprises people. Say you're screening for a rare disease that affects 1 in 1,000 people. Your test is good — 99% sensitivity (catches 99% of true cases) and 99% specificity (only 1% false positive rate). You test positive. How worried should you be?

Your intuition probably says "very." The test is 99% accurate. You tested positive. Surely there's a 99% chance you're sick.

The actual probability: about 9%.

Here's why. Out of 100,000 people, 100 have the disease. The test correctly identifies 99 of them. But it also falsely flags 1% of the 99,900 healthy people — that's 999 false positives. So you're one of 1,098 people with a positive result, and only 99 of you are actually sick. 99 out of 1,098 is approximately 9%.

Bayes' theorem formalizes this arithmetic. And it reveals something important: the answer depends critically on the *prior* — the base rate of the disease before you ever took the test. Change the prior, change the answer. If this disease affects 1 in 10 people instead of 1 in 1,000, that same positive test now gives you a 91% chance of being sick.

This is the question people actually need answered when they're sitting in a doctor's office. And this is exactly what frequentist statistics was built to avoid.

## Why Bayes Was Buried

If Bayesian reasoning is so natural and so useful, why did statistics spend most of the 20th century pretending it didn't exist?

The answer is partially technical and deeply political.

The technical objection is the prior. In Bayesian statistics, you have to start with a prior belief — an initial estimate of the probability before seeing data. In the medical example, the prior was the base rate, which is objective enough. But in many problems, the prior is genuinely subjective. Two scientists analyzing the same data might start with different priors and reach different conclusions. To many statisticians, this was unacceptable. Science was supposed to be objective. The data should speak for itself.

But there's a darker history underneath the technical objection. Many of the founding figures of modern frequentist statistics had deep ties to the eugenics movement, and this wasn't incidental to their statistical philosophy — it shaped it.

Francis Galton, who pioneered regression and correlation, coined the term "eugenics" and spent his career trying to quantify human heredity in service of selective breeding. Karl Pearson, who gave us the chi-squared test and the correlation coefficient, was an avowed eugenicist who edited the *Annals of Eugenics*. Ronald Fisher, arguably the most influential statistician of the 20th century, developed ANOVA, maximum likelihood estimation, and the p-value framework — and was a lifelong advocate for eugenics who served on the editorial board of the *Annals of Human Genetics* (the renamed eugenics journal) until his death.

These men wanted a statistics that felt objective, deterministic, and authoritative. They were trying to build scientific tools that could classify human beings into categories and prescribe social policy based on the results. A framework that said "the answer depends on your prior assumptions, and different assumptions yield different conclusions" was philosophically incompatible with their project. They needed statistics to deliver verdicts, not posterior distributions.

So Bayesian methods were marginalized. Not refuted — marginalized. The arguments against them were philosophical, not mathematical. And for decades, the frequentist framework dominated textbooks, journals, and practice, while Bayesian reasoning was treated as something between a curiosity and a heresy.

It took the computational revolution of the late 20th century — Markov Chain Monte Carlo methods and the processing power to run them — to bring Bayes back from exile. Today, Bayesian methods are everywhere: in machine learning, in medical trials, in spam filters, in self-driving cars. The philosophical debate continues, but the practical argument is settled.

## The Uncomfortable Implication

Here's where things get genuinely weird.

Bayesian probability isn't just a computational technique. It's a philosophical claim about what probability *is*. In the Bayesian view, probability doesn't describe the frequency of events in repeated trials. It describes your *degree of belief* given available information. Probability is epistemic — it's a property of your knowledge, not of the world.

Follow this thread to its conclusion and you arrive at something uncomfortable: probability might just be a measure of ignorance.

Consider a coin flip. Frequentists say the probability of heads is 0.5 because, over many flips, the frequency converges to 50%. But a Bayesian asks: why is it 0.5? Because you don't know the initial conditions. If you knew the exact force, angle, air resistance, surface elasticity, and every other physical variable, you could predict the outcome with certainty. There's no randomness in the physics. The "randomness" is entirely in your lack of information.

Pierre-Simon Laplace articulated this idea in 1814 with a famous thought experiment. Imagine an intelligence — sometimes called Laplace's demon — that knows the position and velocity of every particle in the universe. For this being, nothing is uncertain. The past is fully reconstructable, the future is fully predictable. Probability vanishes. There is only determinism viewed through the fog of incomplete knowledge.

This has a radical implication for statistics itself. If probability is just quantified ignorance, then statistical inference isn't discovering truths about the world — it's managing uncertainty given what you happen to know. Change what you know (update the prior with new data), and the "truth" changes with it. There is no fixed answer waiting to be uncovered. There is only the best you can do with what you have.

In some sense, this means statistics isn't "real" — not in the way we usually mean when we say something is real. It's not describing a feature of the universe. It's describing the gap between what the universe is doing and what we can observe about it. Close that gap — measure everything, know everything — and statistics disappears.

## Why This Matters for Machine Learning

If you're studying machine learning, Bayesian thinking isn't optional — it's the water you're swimming in, whether you realize it or not.

Regularization? That's a prior. When you add an L2 penalty to your loss function, you're encoding a prior belief that your weights should be small. A Gaussian prior on the weights, to be specific. L1 regularization is a Laplacian prior. Every "regularization technique" is a Bayesian prior wearing an optimization costume.

Dropout? It can be interpreted as approximate Bayesian inference over network weights. Batch normalization? It changes the posterior landscape. Transfer learning? You're using a model trained on one task as a prior for another.

And the entire framework of neural network training — starting with random weights and updating them based on observed data — is formally analogous to Bayesian updating. You start with a prior (random initialization), observe evidence (training data), and arrive at a posterior (trained weights). The loss function defines the likelihood. The architecture and regularization define the prior. You may never write down Bayes' theorem explicitly, but you're doing Bayesian inference every time you call `model.fit()`.

The difference between someone who understands this and someone who just memorizes PyTorch API calls is the difference between an ML engineer and an ML practitioner. The math isn't decoration. It's the thing itself.

## The Question That Remains

There's a beautiful tension at the heart of all this. Bayesian probability tells us that uncertainty is subjective — that it's a feature of the observer, not the observed. And yet Bayesian methods produce results that are spectacularly good at predicting the objective world. Spam filters work. Medical diagnoses improve. Language models generate coherent text.

How can a framework built on subjective belief generate objective results? Maybe because subjective belief, properly updated with evidence, converges on something that looks a lot like truth. Or maybe because the distinction between subjective and objective was never as clean as we pretended.

Bayes figured this out in the 1700s. Statistics spent a century ignoring it. The machines figured it out on their own.

---

*This is the second post in a series on the mathematical foundations of machine learning. Previously: [The Strange Simplicity of Machine Learning](/blog/strange-simplicity-of-machine-learning).*
