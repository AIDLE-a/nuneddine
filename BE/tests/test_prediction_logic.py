from schemas import Prediction, Sentiment
from heesun_prediction import _adjust_with_sentiment


def test_adjust_with_sentiment_increases_for_positive_sentiment():
    base = Prediction(future_price=100.0, lower=95.0, upper=105.0)
    sentiment = Sentiment(positive=0.8, negative=0.2)

    adjusted = _adjust_with_sentiment(base, sentiment)

    assert adjusted.future_price > base.future_price
    assert adjusted.lower > base.lower
    assert adjusted.upper > base.upper


def test_adjust_with_sentiment_decreases_for_negative_sentiment():
    base = Prediction(future_price=100.0, lower=95.0, upper=105.0)
    sentiment = Sentiment(positive=0.2, negative=0.8)

    adjusted = _adjust_with_sentiment(base, sentiment)

    assert adjusted.future_price < base.future_price
    assert adjusted.lower < base.lower
    assert adjusted.upper < base.upper
