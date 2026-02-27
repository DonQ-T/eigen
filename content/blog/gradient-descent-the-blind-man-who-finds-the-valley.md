---
title: "Gradient Descent: The Blind Man Who Finds the Valley"
date: 2026-02-26
author: "Matt Jacob"
description: "The algorithm behind all of deep learning is a blind man walking downhill. The strange part is why he almost never gets stuck."
tags: ["gradient descent", "optimization", "loss landscape", "SGD"]
draft: false
---

You're standing on a mountainside in thick fog. You can't see the valley floor. You can't see the peak behind you. You can see approximately nothing. But you can feel the ground under your feet — the slope, the angle, the direction the earth tilts. So you do the obvious thing. You take a step downhill.

Then another. Then another.

That's gradient descent. The algorithm behind every neural network ever trained, every large language model, every image generator, every system that has made the last decade of AI feel like science fiction. The entire $600 billion AI industry runs on a blind man walking downhill.

The math is elegant. The intuition is almost childishly simple. And yet something about gradient descent is deeply strange — because in the kind of landscapes that modern neural networks navigate, landscapes with millions or billions of dimensions, the algorithm has no business working as well as it does. The real mystery isn't how gradient descent works. It's why it works so unreasonably well.

## The Slope Under Your Feet

A neural network has parameters — weights and biases, the knobs you can turn. A loss function measures how wrong the network's predictions are. Training is the process of turning the knobs to make the wrongness smaller.

The loss function defines a landscape. Each possible configuration of parameters is a point in this space, and the loss at that point is the elevation. High loss = mountaintop. Low loss = valley. You want to find the valley.

The gradient is the direction of steepest ascent — the slope under your feet, but pointing uphill. It's a vector of partial derivatives, one for each parameter, telling you how much the loss would change if you nudged each parameter by a tiny amount. Point the gradient in the opposite direction and you've got the way downhill.

The update rule is almost comically simple:

$$w \leftarrow w - \eta \nabla L(w)$$

Take your current parameters $w$. Compute the gradient $\nabla L(w)$. Take a step in the opposite direction, scaled by a *learning rate* $\eta$. That's it. That's the whole algorithm.

The learning rate is how big your steps are. Too large and you overshoot — you leap over the valley and end up on the opposite slope, or worse, you diverge entirely, bouncing higher and higher like a ball in a box. Too small and you crawl, taking thousands of steps where ten would do. Finding the right learning rate is one of the great practical arts of deep learning, and entire papers have been written about it.

To make this concrete: imagine fitting a straight line to a scatter of data points. Your parameters are the slope and intercept. Your loss function is the mean squared error — the average squared distance between your predictions and the actual values:

$$L(w) = \frac{1}{n}\sum_{i=1}^{n}(y_i - \hat{y}_i)^2$$

For linear regression with MSE, the loss landscape is a smooth quadratic bowl. One minimum, no tricks. Gradient descent rolls the ball down the inside of the bowl, and it lands at the bottom every time. Simple, predictable, solved.

Now increase the number of parameters from two to two billion. The landscape stops being a bowl and starts being something no human can visualize. And that's where things get interesting.

## The Fear of Getting Stuck

For decades, the nightmare scenario of neural network training went like this: your loss landscape is bumpy. It has many valleys — many local minima where the gradient is zero and the algorithm thinks it's arrived. But most of these valleys aren't the deepest one. They're good enough to trap you, but not good enough to give you a useful model. Your blind man sits down in a shallow ditch and declares he's reached the valley floor.

This fear was well-founded in low dimensions. Draw a wiggly curve on paper and you can see the problem immediately — dips and troughs everywhere, and no way for a local algorithm to know it hasn't found the global minimum. The 2D pictures were compelling, and they dominated the intuition of the entire field.

The consequences were real. Through the 1990s and 2000s, much of machine learning pivoted toward *convex* optimization — problems where the loss landscape is guaranteed to have a single minimum, no traps, no tricks. Support vector machines, logistic regression, kernel methods — elegant, powerful, and convex. Part of the reason the field embraced these methods so enthusiastically was the conviction that non-convex optimization (which is what neural networks require) was fundamentally unreliable.

Neural networks fell out of fashion. The local minima problem was one of the reasons. If you can't trust the optimizer to find a good solution, why bother with the architecture?

Then people started training very large neural networks on GPUs. And the local minima catastrophe never materialized.

## A Funny Thing Happens in High Dimensions

In 2014, Yann Dauphin and colleagues published a paper that reframed the entire conversation. Their argument was mathematical, but the intuition is geometric.

A local minimum is a point where the gradient is zero and the loss curves *upward in every direction*. Every single dimension must curve upward simultaneously. In two dimensions, this is easy to picture — the bottom of a bowl. But think about what this requires as you increase the number of dimensions.

At any critical point — any point where the gradient is zero — each dimension can curve either up or down. If you have $n$ parameters, that's $n$ independent coin flips. A true local minimum requires all $n$ coins to come up heads. The probability of this is $2^{-n}$. For a network with a million parameters, the probability of a critical point being a local minimum rather than something else is approximately $2^{-1,000,000}$.

It's not that local minima don't exist. It's that they are exponentially rare.

What you actually find instead are *saddle points* — places where the gradient is zero, but the surface curves up in some directions and down in others. Picture a mountain pass: you're at the top of the pass (curving down along the path of travel) but at the bottom of the valley walls (curving up on either side). The gradient is zero, but you're not stuck. You just need to find the downhill direction.

Choromanska et al. extended this analysis using tools from random matrix theory, connecting the loss surfaces of neural networks to a well-studied class of random functions called spin glass models from statistical physics. Their finding: the critical points of neural network loss functions are overwhelmingly saddle points, and the few true local minima that do exist tend to have loss values very close to the global minimum. The bad local minima — the deep traps far from the optimal solution — essentially don't exist in high dimensions.

Neural networks don't get stuck in bad valleys. They get temporarily stalled on saddle points, then escape. The geometry of high-dimensional space is kinder than anyone expected.

## The Noise That Teaches

In practice, nobody computes the gradient on the entire dataset. It's too expensive. If you have a million training examples, computing the exact gradient means running all million through the network, collecting all million error signals, and averaging. Every single step requires a full pass through the data.

Stochastic gradient descent — SGD — takes a shortcut. Instead of computing the gradient on the full dataset, you grab a random subset, a *mini-batch*, and compute the gradient on that:

$$\nabla L_B(w) = \frac{1}{|B|}\sum_{i \in B} \nabla \ell_i(w)$$

This estimate is noisy. It points roughly downhill, but it wobbles. On any given step, the mini-batch gradient might deviate significantly from the true gradient. The blind man isn't just walking downhill — he's stumbling downhill, veering left and right with each step.

This was originally a computational compromise. Full-batch gradient descent is the "correct" algorithm; SGD is the cheap approximation you settle for because you can't afford the real thing. That was the thinking.

The thinking was wrong.

The noise in SGD is *useful*. It helps escape saddle points — a noisy step is more likely to stumble off the saddle in a downhill direction than a precise step that balances perfectly on the ridge. It's the difference between placing a marble on a knife edge and tossing a marble in the general direction of a knife edge. The marble that's tossed will fall to one side.

But the deeper benefit is subtler. Keskar et al. showed in 2017 that the noise in SGD acts as a form of *implicit regularization*. Larger mini-batches (less noise) tend to converge to *sharp* minima — narrow valleys where a small change in parameters causes a large change in loss. Smaller mini-batches (more noise) tend to converge to *flat* minima — broad valleys where the loss doesn't change much if you perturb the parameters.

Flat minima generalize better. A sharp minimum that fits the training data perfectly might not fit the test data at all — shift the input distribution slightly and you've climbed the steep walls of the narrow valley. A flat minimum is robust. It doesn't care about small perturbations.

This connects directly to the [previous article](../the-bias-variance-tradeoff-it-holds-until-it-doesnt). The minimum-norm implicit regularization of gradient descent, the reason overparameterized models generalize when the theory says they shouldn't — SGD's noise is another face of the same phenomenon. The optimizer isn't just finding low points. It's finding the *right kind* of low points. The "wrong" thing — adding noise to your gradient — does the "right" thing — better generalization.

## Momentum and the Art of Falling Faster

Vanilla gradient descent has a problem with ravines — long, narrow valleys where the loss surface curves steeply in one direction and gently in another. The gradient points mostly across the ravine (the steep direction) rather than along it (the direction of progress). The result is oscillation: the optimizer bounces back and forth between the walls while making painfully slow progress toward the bottom.

In 1964, Boris Polyak proposed a fix inspired by physics. Give the optimizer *momentum* — let it accumulate velocity over time, like a ball rolling downhill:

$$v_t = \gamma v_{t-1} + \eta \nabla L(w_t), \quad w_{t+1} = w_t - v_t$$

The velocity $v_t$ is a running average of past gradients, weighted by a momentum coefficient $\gamma$ (typically 0.9). The oscillations across the ravine cancel out — each step bounces in the opposite direction. The progress along the ravine accumulates — each step pushes in the same direction. The ball smooths out the wobble and accelerates along the valley floor.

In 2015, Diederik Kingma and Jimmy Ba published Adam — arguably the most widely used optimizer in deep learning today. Adam combines momentum with *adaptive learning rates*: each parameter gets its own effective step size, scaled by the history of its gradients. Parameters with consistently large gradients get smaller steps; parameters with small, sparse gradients get larger ones. It's gradient descent with a sense of proportion.

These aren't separate ideas. They're refinements of the same principle. The field didn't replace gradient descent — it learned to fall more gracefully. Momentum smooths the path. Adaptivity adjusts the stride. The blind man didn't gain sight. He got better shoes.

## Why the Landscape Is Kinder Than It Looks

Step back. The picture that's emerged is stranger than anyone anticipated.

Gradient descent is a local algorithm — it can only see the slope directly underfoot. It should fail catastrophically in non-convex landscapes with millions of dimensions. It doesn't. The reason, it turns out, is that the landscape itself cooperates.

High-dimensional loss surfaces have structure. Draxler et al. showed in 2018 that different minima found by different training runs are often connected by low-loss paths — you can walk from one solution to another without climbing a significant barrier. This *mode connectivity* suggests that the loss landscape isn't a field of isolated valleys but something more like a connected basin, a broad low-lying region with gentle ridges between slightly different solutions.

And the landscape didn't arrive by accident. The architectures we use were shaped, over years of experimentation, to be optimizable. Residual connections — the skip connections in ResNets — smooth the loss surface by creating shorter gradient paths. Batch normalization and layer normalization reduce the sensitivity of the landscape to parameter scale. Careful weight initialization prevents gradients from exploding or vanishing. We didn't just discover that gradient descent works in high dimensions. We engineered the terrain to suit the traveler.

This connects to everything in this series. The hyperplanes from the [first article](../strange-simplicity-of-machine-learning) define the decision boundaries that the loss landscape encodes. The Bayesian priors from the [second article](../bayesian-probability-is-statistics-even-real) shape the landscape through regularization, implicit and explicit. The bias-variance tradeoff from the [third article](../the-bias-variance-tradeoff-it-holds-until-it-doesnt) describes what happens when you navigate this landscape — when you stop too early, when you push through, when the apparent overfitting dissolves into generalization. Gradient descent is the navigation itself. The act of walking.

## The Blind Man Revisited

Here's what's strange about the story. The blind man on the mountain shouldn't find the valley. The landscape is too complex. The dimensions are too many. The saddle points should stall him. The ravines should trap him. The sheer scale of the space should make any local strategy hopeless.

But the ground is shaped kindly enough — by the geometry of high dimensions, by the structure of real data, by the architectures we've built. And his steps are noisy enough — not precise, not optimal, but noisy in exactly the way that prevents him from balancing on saddle points and nudges him toward flat, generalizable regions. And the momentum of his walk carries him through oscillations and past shallow traps.

He doesn't need to see the valley. He just needs the landscape to have the right structure and his steps to have the right imprecision. And eventually he arrives somewhere good. Not necessarily the global optimum. But somewhere good enough that the models trained this way can translate languages, generate images, write code, and pass medical licensing exams.

Maybe that's a decent metaphor for more than optimization. We rarely see the full landscape of the problems we're navigating. We take the step that seems to go downhill. We get things wrong, and the wrongness jostles us out of places we would have gotten stuck if we'd been more precise. We're shaped by the terrain as much as we shape our path through it.

The blind man finds the valley. Not because he's clever. Because the mountain is kind, and his mistakes are useful.

---

*This is the fourth post in a series on the mathematical foundations of machine learning. Previously: [The Bias-Variance Tradeoff: It Holds Until It Doesn't](../the-bias-variance-tradeoff-it-holds-until-it-doesnt)*
