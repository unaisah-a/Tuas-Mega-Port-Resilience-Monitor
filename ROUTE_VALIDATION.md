# Route validation report

Validation performed on the V6 route dataset.

- Global vessel routes: 18
- Tuas local approaches: 2
- Destination continuity failures: 0
- Missing route endpoints: 0
- Land-intersecting global routes after correction: 0
- Land-intersecting Tuas local approaches: 0
- Projection checks: zoom 2, 2.25, 3, 4, 5, 6, 8, 10, 12, 14, 16 and 18
- Wrapped-world offsets checked: -1080°, -720°, -360°, 0°, +360°, +720° and +1080°

The test can be repeated with:

```bash
npm run test:routes
```

The route data is simulated and must not be used for real navigation.
