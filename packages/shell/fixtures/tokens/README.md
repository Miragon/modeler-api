# Token fixture

`cd-tokens.generated.css` and `cd-tokens.generated.json` of the Miragon design system 1.12.0
(`Miragon/corporate-identity`, `plugins/miragon-brand/skills/modeler-tool-design/assets`, also
published at <https://corporate-identity.netlify.app/brand/>), vendored unchanged for the tests
and the demo. The CSS carries one vendoring header line on top; the JSON cannot carry a comment and
is byte-identical. Never edit them by hand: re-copy both from the source and keep the header.

The shell package itself ships no tokens; a modeler vendors its own copy.
