---
title: "The Strange Simplicity of Machine Learning"
date: 2026-02-25
author: "Matt Jacob"
description: "Most of machine learning comes down to one elegant idea from 1958 — finding a line between points."
tags: ["machine learning", "perceptron", "linear algebra", "neural networks"]
draft: false
---

In 1958, Frank Rosenblatt built a machine at the Cornell Aeronautical Laboratory that could learn to distinguish shapes. He called it the Perceptron. The New York Times ran a story suggesting it would one day "be conscious of its existence." The hype was, predictably, overblown.

But here's what wasn't overblown: the idea behind it. Because nearly seventy years later, the perceptron's core principle is still the beating heart of almost every machine learning model you've ever heard of. From logistic regression to the transformer architecture powering ChatGPT, the final act is almost always the same — find a line that separates one group of things from another.

That's it. That's the strange simplicity of machine learning.

## A Line in the Sand

Let's start with the most basic version. Imagine you have a bunch of data points on a 2D plot. Some are red (spam emails), some are blue (legitimate emails). Your job is to draw a line that puts all the red points on one side and all the blue points on the other.

If you can find that line, congratulations — you've built a classifier. Given a new data point, you just check which side of the line it falls on.

This is exactly what the perceptron does. It takes in some inputs (features of the email — word counts, sender info, whatever), multiplies them by weights, sums them up, and checks whether the result is above or below a threshold. Above? Spam. Below? Not spam. The "learning" part is just adjusting those weights until the line is in the right place.

The equation is almost offensively simple:

$$f(x) = \text{sign}(w^T x + b)$$

That's a dot product and a sign check. That's your entire model.

## More Dimensions, Same Idea

Now here's where it gets interesting. In 2D, you're finding a line. In 3D, you're finding a plane. In 100 dimensions — which is totally normal in ML — you're finding a hyperplane. But it's always the same geometric operation: find the flat surface that best separates two classes of points.

This is not a metaphor. When you train a logistic regression model, you are literally searching for the coefficients of a hyperplane in n-dimensional feature space. When you train a support vector machine, you're finding the hyperplane that maximizes the margin between the two closest points of each class. The math changes. The geometry doesn't.

And here's what's strange: *this works absurdly well for an absurd number of problems.* Email spam detection, tumor classification, credit card fraud, sentiment analysis — throw enough features at a linear separator and it handles a shocking amount of the real world.

## When Lines Aren't Enough

Of course, not everything is linearly separable. Sometimes the red points and blue points are tangled up in ways that no straight line (or flat hyperplane) can sort out. Imagine blue points clustered in a ring around a group of red points. No line fixes that.

This is where the story gets clever rather than complicated. There are essentially two solutions, and they both preserve the same underlying principle:

**Solution 1: Project into a higher dimension.** This is the kernel trick, and it's one of the most elegant ideas in all of machine learning. If your data isn't linearly separable in its current space, map it into a higher-dimensional space where it *is*. That ring-around-the-cluster problem in 2D? Add a third dimension — say, $z = x^2 + y^2$ — and suddenly the classes separate with a flat plane.

Support vector machines exploit this beautifully. The kernel function lets you compute the dot product in a higher-dimensional space without ever actually transforming the data. You get the benefit of the higher dimension without the computational cost. And what are you finding in that higher-dimensional space? A hyperplane. Always a hyperplane.

**Solution 2: Learn the transformation.** This is what neural networks do, and why they're so powerful. Instead of you picking the right transformation by hand, the network learns it.

A deep neural network is, at its core, a stack of perceptrons with nonlinear activation functions between them. Each layer takes the output of the previous layer and applies a new linear transformation followed by a nonlinearity. The effect is that the data gets progressively reshaped, twisted, folded — until, in the final layer, the classes are linearly separable.

Then the last layer finds the hyperplane.

That's the punchline. Every hidden layer in a neural network is doing feature engineering. It's learning a representation of the data that makes the problem easy enough for a linear separator to finish the job. The sophistication isn't in the final decision — it's in the transformation that makes the final decision trivial.

## From Perceptrons to Transformers

This pattern scales all the way up. Consider the transformer, the architecture behind modern large language models. It's an enormously complex system with attention mechanisms, positional encodings, layer normalization, billions of parameters. But at the very end, when it needs to predict the next token, what does it do?

It takes a high-dimensional representation of the context, runs it through a linear layer, and applies softmax to get a probability distribution over possible outputs. That linear layer? It's finding a hyperplane. Multiple hyperplanes, technically — one for each possible output class. But the principle is identical to Rosenblatt's perceptron.

The transformer didn't transcend the perceptron. It just got extraordinarily good at building the representations that make the perceptron's job easy.

## Why This Matters

There's a practical lesson here and a philosophical one.

The practical lesson: if you're learning machine learning, don't rush past linear models. Understand logistic regression deeply. Understand what a decision boundary is, what it means geometrically, how regularization changes the shape of the solution. This isn't "beginner stuff" you outgrow — it's the foundation that everything else is built on. When you understand what an SVM is really doing, neural networks stop being black boxes and start being clever feature extractors feeding into something you already understand.

The philosophical lesson is more unsettling. We have built systems that can write poetry, generate images, hold conversations, and pass professional exams. And at their core, they are finding lines between points in high-dimensional space. The representation learning is staggering in its complexity. But the final act of "intelligence" is the same geometric operation a machine performed in a Cornell lab in 1958.

Maybe that says something profound about the nature of intelligence. Or maybe it just says that the right representation makes everything look simple. Either way, the strange simplicity is worth sitting with.

---

*This is the first post in a series exploring the mathematical foundations of machine learning. Next up: why Bayesian probability suggests statistics might not even be real.*
