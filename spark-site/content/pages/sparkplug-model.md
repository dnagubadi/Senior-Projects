> **First draft.** These parts are sized for common arcade buttons, a thumb joystick and knob potentiometers. Measure your real parts before you print.

# What's in the files

| File | What it is | How to print it |
| --- | --- | --- |
| [sparkplug-enclosure.stl](models/sparkplug-enclosure.stl) | The top shell, with holes for every control | Upside down, open side up. 0.2 mm layers, 15% infill |
| [sparkplug-knob.stl](models/sparkplug-knob.stl) | One knob cap, with a notch so you can see which way it points | Print 3, flat side down |
| [sparkplug-ignite.stl](models/sparkplug-ignite.stl) | The Ignite cap: a half sphere, like the Spark logo | Flat side down |
| [sparkplug-assembly.stl](models/sparkplug-assembly.stl) | Everything together | For looking at only, don't print |

# Size

- **Body:** 240 × 140 × 45 mm, with rounded corners. It fits on a 256 mm printer bed.
- **Walls:** 3 mm thick, open at the bottom so the electronics can go inside.
- **Screw posts:** one in each corner, with 3 mm pilot holes for a bottom plate.
- **USB-C cutout:** 13 × 7 mm, in the middle of the back wall.

# Controls and hole sizes

| Control | Hole | Fits |
| --- | --- | --- |
| Joystick | 30 mm, with a raised ring around it | A thumb joystick module |
| 3 knobs | 7.5 mm | Potentiometers with a 6 mm shaft |
| 4 buttons | 24 mm | 24 mm arcade buttons |
| Ignite | 60 mm | A 60 mm dome arcade button |

# Changing the model

The model is built by a script, so every size is a number you can change:

1. Open `models/sparkplug.py` and edit the numbers under **SETTINGS**.
2. In Terminal, from the `spark-site/models` folder, run `/Applications/Blender.app/Contents/MacOS/Blender -b --python sparkplug.py`
3. The STL files and the preview pictures on this page update by themselves.

[[Add a photo of the first printed prototype here.]]
