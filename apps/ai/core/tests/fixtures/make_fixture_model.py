"""Builds the tiny LiteRT model used by the AI service tests (needs TensorFlow; run once).

Same input/output contract as the real CNN — 224x224x3 RGB 0-255 in, 7 softmax probabilities
out, class order from shared/constants.json — but with hand-set weights so results are
predictable: mostly-red image → road_damage, mostly-green → garbage, mostly-blue → streetlight,
grey → low confidence. ~2 KB, so it can live in git.

    python apps/ai/core/tests/fixtures/make_fixture_model.py
"""

import json
from pathlib import Path

import numpy as np
import tensorflow as tf

HERE = Path(__file__).resolve().parent
CLASSES = json.loads((HERE.parents[4] / "shared" / "constants.json").read_text())[
    "complaintCategories"
]

inputs = tf.keras.Input((224, 224, 3))
x = tf.keras.layers.Rescaling(1 / 255.0)(inputs)
x = tf.keras.layers.GlobalAveragePooling2D()(x)  # mean R, G, B in 0..1
dense = tf.keras.layers.Dense(len(CLASSES))
logits = dense(x)
outputs = tf.keras.layers.Softmax()(logits)
model = tf.keras.Model(inputs, outputs)

w = np.zeros((3, len(CLASSES)), dtype=np.float32)
w[0, 0] = w[1, 1] = w[2, 2] = 12.0  # R → road_damage, G → garbage, B → streetlight
w[:, 0:3] -= 6.0  # grey (R≈G≈B) cancels out → all 7 classes near-equal → low confidence
dense.set_weights([w, np.zeros(len(CLASSES), dtype=np.float32)])

tflite = tf.lite.TFLiteConverter.from_keras_model(model).convert()
(HERE / "test_model.tflite").write_bytes(tflite)
(HERE / "model_card.json").write_text(
    json.dumps(
        {
            "modelVersion": "civic_cnn_test",
            "classes": CLASSES,
            "input": {"size": 224, "format": "rgb_0_255"},
        },
        indent=2,
    )
)
print(f"wrote test_model.tflite ({len(tflite)} bytes)")
