from core.constants import complaint_categories, get_constants


def test_loads_shared_constants():
    c = get_constants()
    assert c["defaultLanguage"] == "hi"
    assert "SUBMITTED" in c["complaintStatus"]


def test_cnn_classes_match_docs():
    assert complaint_categories() == [
        "road_damage",
        "garbage",
        "streetlight",
        "waterlogging",
        "water_supply",
        "encroachment",
        "other",
    ]
