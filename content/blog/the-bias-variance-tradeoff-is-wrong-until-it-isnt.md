---
title: "The Bias-Variance Tradeoff Is Wrong (Until It Isn't)"
date: 2026-02-26
author: "Matt Jacob"
description: "The textbook says more training means more overfitting — until a researcher went on vacation and came back to find the opposite was true."
tags: ["bias-variance", "grokking", "double descent", "generalization"]
draft: false
---

You're training a model. Training loss is dropping nicely. Then you glance at validation loss and — there it is. The curve has turned upward. The gap is widening. Every textbook, every lecture, every blog post you've ever read says the same thing: *stop*. You're overfitting. More training will only make it worse.

So you stop. You tune your regularization. You reduce your model size. You do everything the theory tells you to do, because the theory is backed by a clean, beautiful mathematical decomposition that has governed machine learning for decades.

And the theory is correct. Right up until it isn't.

In 2021, a researcher at OpenAI left a small model training on a simple arithmetic task over a long weekend. The model had already memorized the training data. Validation accuracy was flat at zero generalization. By every known principle, it was done — fully overfit, permanently useless on unseen inputs. But the compute was cheap and nobody turned it off.

When they came back, the model had learned to generalize. Not a little. Perfectly.

Something had happened that the textbooks said was impossible. And it would take years of new theory to explain why.

## The Textbook Version

Before we break the rules, let's understand them. Because the bias-variance tradeoff isn't wrong — it's one of the most elegant results in statistical learning theory, and it describes something real.

Start with a concrete picture. You have a cloud of data points that follow some true underlying curve, plus noise. You want to fit a model that captures the curve without chasing the noise. The question is: how complex should your model be?

If your model is too simple — say, a straight line through data that's clearly curved — it will systematically miss the pattern. It'll be wrong in the same way every time, no matter how much data you show it. This is *bias*. The model's assumptions are too rigid to capture reality.

If your model is too complex — say, a degree-50 polynomial through 20 data points — it will hit every training point exactly. Beautiful on the training set. Catastrophic on anything new. Wiggle the data slightly and you get a completely different curve. This is *variance*. The model is so flexible that it's fitting noise rather than signal.

The bias-variance decomposition makes this precise. For any model, the expected prediction error at a point can be decomposed into exactly three terms:

$$E[(y - \hat{f}(x))^2] = \text{Bias}[\hat{f}(x)]^2 + \text{Var}[\hat{f}(x)] + \sigma^2$$

The first term is the squared bias — how far off your model's average prediction is from the truth. The second is the variance — how much your model's predictions scatter depending on which training set you happened to draw. The third is irreducible noise. You can't touch $\sigma^2$. It's the universe's tax on prediction.

The tradeoff appears because bias and variance pull in opposite directions. Simple models have high bias and low variance. Complex models have low bias and high variance. The total error is U-shaped: decrease one and you increase the other. Somewhere in the middle is the sweet spot — the model complex enough to capture the real pattern but not so complex that it chases noise.

This is real math. It's a theorem, not a heuristic. And for most of the history of machine learning, it was the law.

## The U-Shaped Curve and the Art of Knowing When to Stop

The bias-variance tradeoff implies a practical discipline: find the bottom of the U and stop there.

This gave rise to an entire ecosystem of techniques. Early stopping — monitor validation loss and halt training when it starts climbing. Cross-validation — estimate the sweet spot by rotating through held-out folds. Regularization — add a penalty that shrinks your model's effective complexity. L2 regularization, as we discussed in the Bayesian article, is literally a Gaussian prior on your weights — a formal statement that you believe the true parameters are probably small.

All of these techniques share the same implicit assumption: *there is an optimal model complexity, and exceeding it always hurts*. The U-shaped curve has a single minimum. Go past it and you're in overfitting territory. The more parameters, the worse the generalization. Always.

This assumption felt obvious. It was confirmed by theory. It was confirmed by practice — at least on the models and datasets people were working with through the 1990s and 2000s. It became one of those ideas so well-established that questioning it felt like questioning gravity.

Then deep learning happened. And the models got big. Absurdly, incomprehensibly big. Models with millions, then billions of parameters — far more parameters than training examples. By the classical theory, these models should have been hopelessly overfit. They should have memorized their training data and failed spectacularly on anything new.

They didn't. They generalized beautifully. And nobody could explain why.

## What Happened Over the Long Weekend

The story of grokking begins with a question that sounds almost trivial: can a neural network learn modular arithmetic?

The task is simple. Given two numbers $a$ and $b$, compute:

$$f(a, b) = (a + b) \mod 97$$

That's it. Addition, then take the remainder when dividing by 97. A lookup table could solve this. A pocket calculator could solve this. The question was whether a small transformer could learn the *pattern* rather than just memorizing the answers.

Alethea Power and colleagues at OpenAI trained a small transformer on a subset of all possible input pairs. The model memorized the training set almost immediately — training loss dropped to zero within a few hundred steps. Validation accuracy? Flat. The model was reciting answers it had seen and guessing randomly on everything else. Classic overfitting, exactly as the textbooks predicted.

In the standard workflow, you'd stop here. The model has converged. Further training is pointless — or worse, harmful. Every signal says: *done*.

But the researchers kept training. Not because they expected anything to happen. They kept training because — as the lore goes — someone went on vacation and left the job running. The compute budget was trivial. Nobody bothered to kill it.

Somewhere around step 30,000 — long after the model had perfectly memorized every training example — validation accuracy began to climb. Not gradually. Not noisily. It shot up, almost vertically, from near-zero to near-perfect generalization. The model had suddenly *understood* modular arithmetic. It had discovered the algorithm, not just memorized the data.

They called this phenomenon *grokking* — a term borrowed from Heinlein meaning to understand something so thoroughly that it becomes part of you. The model hadn't just learned the mapping. It had found the underlying structure. And it had done so *long after* the point where every classical indicator said learning was over.

Power et al. published the result in 2022. The paper's title was modest: "Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets." Its implications were not modest at all.

## The Interpolation Threshold and What Lies Beyond

Grokking was dramatic, but it wasn't the only crack in the classical picture. Around the same time, Mikhail Belkin and collaborators were documenting something equally strange in a more traditional setting.

The classical story says test error is U-shaped as a function of model complexity. Belkin et al. showed that this is only the first half of the story. If you keep increasing model complexity past the point where the model can perfectly interpolate the training data — the *interpolation threshold*, roughly where the number of parameters $p$ equals the number of training examples $n$ — something unexpected happens.

Test error peaks at the interpolation threshold. This part matches the classical theory. But then, as you keep adding parameters — moving deeper into the overparameterized regime where $p \gg n$ — test error starts *decreasing again*. A second descent. The curve isn't U-shaped. It's shaped more like a double-U, or a roller coaster that dips, rises, and then dips again.

They called it *double descent*, and it appears across model families — from random forests to neural networks to simple linear regression. It's not a quirk of a particular architecture. It's a property of overparameterization itself.

Why does this happen? The key insight is that when you have far more parameters than data points, there are infinitely many models that perfectly fit the training data. The training loss is zero for all of them. But they're not all equally good. Gradient descent, by its nature, tends to find a particular solution among these — the one with the smallest norm:

$$\hat{w} = \arg\min \|w\| \text{ subject to } Xw = y$$

This minimum-norm solution acts as an implicit regularizer. It's as if the optimization algorithm has a built-in preference for simplicity, even when you never asked for it. Among all the models that memorize your training data perfectly, gradient descent gravitates toward the smoothest, most generalizable one.

And this connects back to grokking. If double descent describes what happens as you increase model complexity at a fixed training time, grokking is what happens when you increase training time at a fixed model complexity. They're the same phenomenon viewed from different axes. In both cases, the system passes through a regime of apparent overfitting and emerges — on the other side — into genuine understanding.

The model memorizes first. Then, given enough capacity or enough time, it simplifies. It finds the pattern underneath the memorization. The noisy lookup table gets compressed into an algorithm.

## The Rule Was Never Really a Rule

So is the bias-variance tradeoff wrong?

No. It's incomplete.

The decomposition $E[(y - \hat{f}(x))^2] = \text{Bias}^2 + \text{Var} + \sigma^2$ is still mathematically true. Bias and variance still trade off against each other. The U-shaped curve is real — you can observe it clearly in the classical regime, with small models and small datasets and the kind of learning problems that dominated ML before 2012.

What the tradeoff doesn't account for is what happens when you push *through* the danger zone rather than stopping at its edge. It assumes you'd never intentionally overparameterize. It assumes the interpolation threshold is a cliff, not a ridge with a valley on the other side.

The modern understanding is that the classical regime and the overparameterized regime are governed by different dynamics. In the classical regime, you don't have enough parameters to fit the data smoothly, so extra complexity means extra noise sensitivity. In the overparameterized regime, you have so many degrees of freedom that the optimizer can find a smooth solution even while perfectly fitting the training data. The implicit bias of gradient descent does the work that explicit regularization used to do.

This is why large language models work. GPT-4, Claude, Llama — these models have hundreds of billions of parameters trained on datasets that, while enormous, are still finite. They operate deep in the overparameterized regime. By the classical theory, they should be the most overfit models in history. Instead, they're the most capable. The bias-variance tradeoff would have told you not to build them.

And this connects to everything we've discussed in this series. The hyperplanes from the [first article](../strange-simplicity-of-machine-learning) — when you overparameterize, there are infinitely many hyperplanes that separate your training data, and gradient descent picks the one with the largest margin. The Bayesian priors from the [second article](../bayesian-probability-is-statistics-even-real) — the implicit regularization of gradient descent *is* a prior, just one that emerges from the optimization dynamics rather than being written down explicitly. The math keeps circling back on itself.

## Sitting with the Contradiction

There's something deeply human about the bias-variance tradeoff. We love clean rules. We love knowing when to stop. We love the idea that there's an optimal amount of complexity and that wisdom lies in finding it — not too simple, not too complex, but just right. The Goldilocks zone. The sweet spot. The middle path.

And the tradeoff delivers exactly that. It's a mathematical permission slip to be moderate. It says: don't overthink it. Don't overfit it. Know your limits. Stop while you're ahead.

It's true enough to be dangerous.

Because the deepest results in modern machine learning come from ignoring that advice. From building models that are grotesquely overparameterized. From training long past the point of memorization. From trusting that the optimization landscape has structure that the classical theory doesn't see.

The bias-variance tradeoff is a map of the terrain near the village. It's accurate, detailed, and useful. But the territory extends far beyond the map's edges, and out there — past the interpolation threshold, past the point of apparent overfitting, deep in the overparameterized wilderness — the landscape follows different rules. Rules we're only beginning to understand.

The machines figured this out before we did. They just needed someone to forget to stop them.

---

*This is the third post in a series on the mathematical foundations of machine learning. Previously: [Bayesian Probability: Is Statistics Even Real?](../bayesian-probability-is-statistics-even-real)*
