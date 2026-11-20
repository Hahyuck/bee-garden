"""Author the in-place action clips for the five Bee Garden VRChat avatars.

Run with Python 3 from any directory. The GLBs supply their own skeleton, limb
lengths and existing idle/walk clips. Regeneration replaces only our action data.
"""
import json
import math
import struct
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / "assets"
ACTIONS = ("TrailRun", "TrailJump", "TrailCrouch", "TrailCrouchWalk")
SIDES = (("Left", 1), ("Right", -1))

# phase, thigh pitch, knee pitch, foot pitch relative to a level sole
RUN = (
    (0.00, .72, -.77, .08), (.12, .32, -.98, .01),
    (.32, -.41, -.49, .08), (.48, -.64, -.95, .40),
    (.62, -.24, -1.76, .27), (.79, .84, -1.59, -.06),
    (.90, .98, -.83, -.07), (1.00, .72, -.77, .08),
)
LOW_WALK = (
    (0.00, 1.27, -1.78, .03), (.25, 1.03, -1.78, 0.0),
    (.48, .72, -1.76, .10), (.63, .92, -2.03, .14),
    (.82, 1.33, -1.99, -.04), (1.00, 1.27, -1.78, .03),
)
# phase, left thigh+knee, right thigh+knee, arm swing, elbow bend, torso pitch, foot planting.
# The controller supplies the whole-body height and samples 12% to 80% while airborne.
JUMP = (
    (0.00, .65,-1.20, .65,-1.20,-.20,.48,-.18,1),
    (.12,  .11, -.23, .16, -.30, .56,.80,-.09,1),
    (.29,  .78,-1.32, .30,-1.01, .58,.90,-.15,.0),
    (.47,  .92,-1.56, .36,-1.16, .30,.92,-.17,.0),
    (.64,  .57,-1.10, .24, -.79, .13,.68,-.11,.1),
    (.80,  .18, -.37, .17, -.34, .10,.56,-.07,1),
    (.90,  .86,-1.57, .84,-1.54,-.05,.76,-.22,1),
    (1.00, .03, -.05, .03, -.05,-.04,.24,-.025,1),
)


def sample(frames, t):
    for a, b in zip(frames, frames[1:]):
        if t <= b[0]:
            u = max(0, (t - a[0]) / (b[0] - a[0]))
            u = u * u * (3 - 2 * u)
            return [x + (y - x) * u for x, y in zip(a[1:], b[1:])]
    return frames[-1][1:]


def rotation(x=0, y=0, z=0):
    sx, sy, sz = (math.sin(v / 2) for v in (x, y, z))
    cx, cy, cz = (math.cos(v / 2) for v in (x, y, z))
    return (sx*cy*cz+cx*sy*sz, cx*sy*cz-sx*cy*sz, cx*cy*sz+sx*sy*cz, cx*cy*cz-sx*sy*sz)


def ankle_offset(thigh, knee, shin_vector, foot_vector):
    """Sagittal ankle offset from bind pose, in this avatar's own units."""
    dy = dz = 0
    for angle, (_, y, z) in ((thigh, shin_vector), (thigh+knee, foot_vector)):
        c, s = math.cos(angle), math.sin(angle)
        dy += (c-1)*y - s*z
        dz += s*y + (c-1)*z
    return dy, dz


def pose(action, phase, bind):
    frame = {}
    ankles = []
    cycle = phase * math.tau
    if action == "TrailJump":
        lt, lk, rt, rk, arm, elbow, spine, planted = sample(JUMP, phase)
    for side, sign in SIDES:
        side_phase = (phase + (0 if sign == 1 else .5)) % 1
        wave = math.cos(side_phase * math.tau)
        if action == "TrailRun":
            thigh, knee, sole = sample(RUN, side_phase)
            arm, elbow = -.70*wave, 1.05 - .15*wave
        elif action == "TrailCrouchWalk":
            thigh, knee, sole = sample(LOW_WALK, side_phase)
            arm, elbow = .16-.22*wave, .75
        elif action == "TrailCrouch":
            thigh = 1.08 + .017*math.sin(cycle)
            knee, sole = -1.83 - .021*math.sin(cycle), 0
            arm, elbow = .19 + .013*math.sin(cycle), .84
        else:
            thigh, knee = (lt, lk) if sign == 1 else (rt, rk)
            sole = .10 * math.sin(phase * math.pi)
        frame[side+"UpLeg"] = rotation(thigh)
        frame[side+"Leg"] = rotation(knee)
        frame[side+"Foot"] = rotation(sole-thigh-knee)
        frame[side+"Arm"] = rotation(arm, 0, sign*(1.28 if action == "TrailRun" else 1.26))
        frame[side+"ForeArm"] = rotation(0, -sign*elbow, 0)
        ankles.append(ankle_offset(thigh, knee, bind[side+"Leg"], bind[side+"Foot"]))

    hip_x, hip_y, hip_z = bind["Hips"]
    # Translate the pelvis rather than scaling the mesh so different leg lengths
    # actually produce different squat depths. Both feet stay planted in a held crouch.
    lowest = min(a[0] for a in ankles)
    if action == "TrailRun":
        frame["Spine"] = rotation(-.19, .13*math.cos(cycle), .031*math.sin(cycle))
        flight = max(0.0, -math.cos(2*cycle))**2
        hip_y += -lowest + .05*bind["Hips"][1]*flight
    elif action == "TrailJump":
        frame["Spine"] = rotation(spine)
        hip_y -= lowest * planted
        hip_z -= (ankles[0][1]+ankles[1][1])*.5*planted
    else:
        twist = .065*math.cos(cycle) if action == "TrailCrouchWalk" else 0
        frame["Spine"] = rotation(-.29+.011*math.sin(cycle), twist)
        hip_y -= lowest
        hip_z -= (ankles[0][1]+ankles[1][1])*.5
    frame["Hips"] = (hip_x, hip_y, hip_z)
    return frame


def strip_generated(doc, binary):
    keep, generated = [], set()
    for clip in doc["animations"]:
        if clip["name"] in ACTIONS:
            for channel in clip["samplers"]:
                generated.update((channel["input"], channel["output"]))
        else:
            keep.append(clip)
    if not generated:
        return
    # Never truncate shared or interleaved third-party data.
    first = min(generated)
    views = {doc["accessors"][index]["bufferView"] for index in generated}
    first_view = min(views)
    if (generated != set(range(first, len(doc["accessors"]))) or
            views != set(range(first_view, len(doc["bufferViews"]))) or
            any(a["bufferView"] in views for a in doc["accessors"][:first])):
        raise ValueError("Action data must be the final, private GLB buffer views")
    del binary[doc["bufferViews"][first_view]["byteOffset"]:]
    del doc["accessors"][first:]
    del doc["bufferViews"][first_view:]
    doc["animations"] = keep


def accessor(doc, binary, samples, kind):
    raw = b"".join(struct.pack("<" + "f"*len(row), *row) for row in samples)
    view = {"buffer": 0, "byteOffset": len(binary), "byteLength": len(raw)}
    doc["bufferViews"].append(view)
    binary.extend(raw)
    acc = {"bufferView":len(doc["bufferViews"])-1, "type":kind, "componentType":5126, "count":len(samples)}
    if kind == "SCALAR":
        acc.update(min=list(samples[0]), max=list(samples[-1]))
    doc["accessors"].append(acc)
    return len(doc["accessors"]) - 1


def chunk(data, kind, padding):
    data += padding * (-len(data) % 4)
    return struct.pack("<I4s", len(data), kind) + data


def author(path):
    original = path.read_bytes()
    json_size = struct.unpack_from("<I", original, 12)[0]
    doc = json.loads(original[20:20+json_size])
    start = 28 + json_size
    binary = bytearray(original[start:start+doc["buffers"][0]["byteLength"]])
    strip_generated(doc, binary)
    binary.extend(b"\0" * (-len(binary) % 4))
    idle = next(clip for clip in doc["animations"] if clip["name"] == "TrailIdle")
    targets = {}
    bind = {}
    for channel in idle["channels"]:
        target = channel["target"]
        node = doc["nodes"][target["node"]]
        name = node["name"].split(":")[-1]
        targets[name] = target
        bind[name] = node["translation"]
    for action, duration, steps in zip(ACTIONS, (.70, 1, 2, 1.15), (28, 40, 24, 32)):
        phases = [i / steps for i in range(steps + 1)]
        frames = [pose(action, t, bind) for t in phases]
        timeline = accessor(doc, binary, [(t*duration,) for t in phases], "SCALAR")
        channels, samplers = [], []
        for name, target in targets.items():
            kind = "VEC3" if target["path"] == "translation" else "VEC4"
            output = accessor(doc, binary, [frame[name] for frame in frames], kind)
            channels.append({"sampler":len(samplers), "target":target})
            samplers.append({"input":timeline, "output":output, "interpolation":"LINEAR"})
        doc["animations"].append({"name":action, "samplers":samplers, "channels":channels})
    doc["buffers"][0]["byteLength"] = len(binary)
    doc["asset"]["copyright"] = doc["asset"]["copyright"].split(". ")[0] + ". Motions authored for Bee Garden."
    payload = chunk(json.dumps(doc,separators=(",",":")).encode(), b"JSON", b" ") + chunk(binary, b"BIN\0", b"\0")
    final = struct.pack("<4sII", b"glTF", 2, len(payload)+12) + payload
    if original != final:
        path.write_bytes(final)


if __name__ == "__main__":
    people = ASSETS/"samples"/"people"
    files = [ASSETS/"actors"/"kate.glb"]
    files.extend(people/entry["file"] for entry in json.loads((people/"catalog.json").read_text("utf-8")))
    for file in files:
        author(file)
