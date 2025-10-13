def calculate_accuracy(predictions, labels):
    correct = sum(p == l for p, l in zip(predictions, labels))
    return correct / len(labels) if labels else 0

def calculate_precision(predictions, labels):
    true_positive = sum(p == 1 and l == 1 for p, l in zip(predictions, labels))
    false_positive = sum(p == 1 and l == 0 for p, l in zip(predictions, labels))
    return true_positive / (true_positive + false_positive) if (true_positive + false_positive) > 0 else 0

def calculate_recall(predictions, labels):
    true_positive = sum(p == 1 and l == 1 for p, l in zip(predictions, labels))
    false_negative = sum(p == 0 and l == 1 for p, l in zip(predictions, labels))
    return true_positive / (true_positive + false_negative) if (true_positive + false_negative) > 0 else 0

def calculate_f1_score(predictions, labels):
    precision = calculate_precision(predictions, labels)
    recall = calculate_recall(predictions, labels)
    return 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

def save_model(model, filepath):
    import joblib
    joblib.dump(model, filepath)

def load_model(filepath):
    import joblib
    return joblib.load(filepath)