def accuracy(y_true, y_pred):
    correct = (y_true == y_pred).sum().item()
    total = y_true.size(0)
    return correct / total

def precision(y_true, y_pred):
    true_positive = ((y_true == 1) & (y_pred == 1)).sum().item()
    false_positive = ((y_true == 0) & (y_pred == 1)).sum().item()
    return true_positive / (true_positive + false_positive) if (true_positive + false_positive) > 0 else 0.0

def recall(y_true, y_pred):
    true_positive = ((y_true == 1) & (y_pred == 1)).sum().item()
    false_negative = ((y_true == 1) & (y_pred == 0)).sum().item()
    return true_positive / (true_positive + false_negative) if (true_positive + false_negative) > 0 else 0.0

def f1_score(y_true, y_pred):
    prec = precision(y_true, y_pred)
    rec = recall(y_true, y_pred)
    return 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

def confusion_matrix(y_true, y_pred):
    tp = ((y_true == 1) & (y_pred == 1)).sum().item()
    tn = ((y_true == 0) & (y_pred == 0)).sum().item()
    fp = ((y_true == 0) & (y_pred == 1)).sum().item()
    fn = ((y_true == 1) & (y_pred == 0)).sum().item()
    return {'TP': tp, 'TN': tn, 'FP': fp, 'FN': fn}