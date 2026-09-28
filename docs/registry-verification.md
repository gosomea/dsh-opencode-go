# npm release verification — 2026-09-28

Published package: `@foreveryu/dsh-opencode-go@0.1.0`, public access, `latest`. Source commit: `6c52820da9bcf12263a9d93daa51d23afd131da8`. The unscoped npm name is owned by another author.

Registry integrity: `sha512-UvUJuRLsCeC/Uy38PkM4Q3efvI4J6BIbORQOMJrnMwUvg/ttXTA8UjAGyqG2GdLOWLln8Z2pkYPiCkM5Kb2bZw==`. The registry integrity and SHA-1 matched the verified publication tarball. All 21 installed package files matched that tarball byte for byte.

## Installation and runtime

The supported compatible-source launcher executed:

```sh
dsh plugin --profile web add @foreveryu/dsh-opencode-go@0.1.0 --store-dir <empty-test-store>
```

The test profile used an isolated home and a newly allocated empty pnpm store: 94 dependencies downloaded, zero reused. The profile dependency is the registry version `0.1.0`, not a file or link, and its selected bundle is `@foreveryu/dsh-opencode-go`. The existing tarball dependency tree was retained separately before reinstalling.

The installed registry package loaded in the compatible Web Host. Its authenticated catalog API returned HTTP 200 with no error and 82 Zen / 43 Go entries. Go had 35 verified chat models and two zero-rate chat models; Zen had 80 chat models and eleven zero-rate chat models. Protocol-unconfirmed entries stayed diagnostic. No new paid inference was run for this release check; prior actual inference evidence is in [verification](verification.md).

The browser loaded the scoped client module, opened Settings → Models, switched to Go and enabled the zero-rate filter. Exactly LongCat 2.5 Preview Free and Space Bunny Free remained, with zero input/output rates and the expected cache price columns. This was compared with the Host catalog outside the browser.

The daily source-link installation was renamed to the scoped identity and restarted after an idle check. All 481 daily Sessions remained listed and idle; other dependency entries and the provider patch were unchanged. The daily Host remains available for user validation.

The published artifact still requires the generic Host extensions in [Host compatibility](host-compatibility.md); installation alone does not patch an unmodified official release.
