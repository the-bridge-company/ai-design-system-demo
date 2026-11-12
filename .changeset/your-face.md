---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": minor
---

Your face: a drawn face that is yours and never a teammate's. `@bridge-ds/react/avatar-illustrated` draws a face from
its parts (`FaceRecipe`, `faceRecipe(seed)`, `illustratedFaceSvg`, `illustratedFaceUri`, `FACE_PART_VARIANTS`). In
Studio, Settings > You opens with "Your face": Change, Shuffle (a 300ms riffle, none under reduced motion) and, on
demand, the parts (hair, glasses, beard, expression) with a teammate's style taken and named. The face is kept on the
Bridge account (`POST /api/account { action: 'face' }`, 409 `face_taken` naming who wears the style) and in each team's
face map, read with the team; every surface draws through it, and a new member gets a distinct face by itself (their
seed redrawn until its hair is free). On the sample team the face stays in this browser. The account menu shows the
person's role on this team under their email.
