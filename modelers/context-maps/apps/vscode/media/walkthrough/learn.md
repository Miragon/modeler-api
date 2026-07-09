# Learn the basics

Context Maps model a system as **bounded contexts** and the **relationships** between them.

**The three subdomain types**

- **Core** — business-critical and differentiating; where competitive advantage is built.
- **Supporting** — specialised, but not differentiating; needed to support the core.
- **Generic** — a solved, off-the-shelf problem; buy or adopt rather than build.

**The five relationship patterns**

- **Partnership (P)** and **Shared Kernel (SK)** — symmetric, high-coordination relationships.
- **Customer-Supplier (C/S)** and **Upstream-Downstream (U/D)** — asymmetric, with U/D end markers.
- **Separate Ways (SW)** — no integration; functionality is duplicated rather than shared.

Asymmetric relationships carry **integration roles**: upstream can be an Open Host Service (OHS)
and/or a Published Language (PL); downstream can apply an Anticorruption Layer (ACL) or be a
Conformist (CF).

**Working in the editor**

- Drag a subdomain type from the palette onto the canvas, then click its label to rename it.
- Connect two contexts with a relationship, then pick its pattern and integration roles.
- Select an element to get its context pad, which renames, connects or deletes it.

Your changes are saved straight back into the `.tt` file, so diagrams version nicely in Git.

New to the method? Read up on strategic DDD context maps in Kaiser's _Architecture for Flow_ and
Vernon's _DDD Distilled_.
