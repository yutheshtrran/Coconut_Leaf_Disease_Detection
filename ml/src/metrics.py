import numpy as np

def _to_numpy(x):
    if hasattr(x, 'detach'):
        return x.detach().cpu().numpy()
    if isinstance(x, list):
        return np.array(x)
    return x

def accuracy(y_true, y_pred):
    y_true, y_pred = _to_numpy(y_true), _to_numpy(y_pred)
    return float((y_true == y_pred).sum() / y_true.size) if y_true.size else 0.0

def confusion_matrix(y_true, y_pred):
    y_true, y_pred = _to_numpy(y_true).ravel(), _to_numpy(y_pred).ravel()
    if y_true.size == 0: return np.zeros((0,0), dtype=int)
    labels = np.unique(np.concatenate([y_true, y_pred]))
    label_to_idx = {l:i for i,l in enumerate(labels)}
    K = len(labels)
    cm = np.zeros((K,K), dtype=int)
    for t,p in zip(y_true, y_pred):
        cm[label_to_idx[t], label_to_idx[p]] += 1
    return cm

def precision_recall_f1(y_true, y_pred, average='macro'):
    y_true, y_pred = _to_numpy(y_true).ravel(), _to_numpy(y_pred).ravel()
    if y_true.size == 0: return {'precision':0,'recall':0,'f1':0}
    labels = np.unique(np.concatenate([y_true, y_pred]))
    cm = confusion_matrix(y_true, y_pred)
    per_class = {}
    supports = cm.sum(axis=1)
    for i,label in enumerate(labels):
        tp = cm[i,i]; fp = cm[:,i].sum()-tp; fn = cm[i,:].sum()-tp
        prec = tp/(tp+fp) if tp+fp>0 else 0.0
        rec = tp/(tp+fn) if tp+fn>0 else 0.0
        f1 = 2*prec*rec/(prec+rec) if prec+rec>0 else 0.0
        per_class[label] = {'precision':prec,'recall':rec,'f1':f1,'support':int(supports[i])}
    if average is None: return per_class
    precisions, recalls, f1s = [v['precision'] for v in per_class.values()], [v['recall'] for v in per_class.values()], [v['f1'] for v in per_class.values()]
    return {'precision': float(np.mean(precisions)), 'recall': float(np.mean(recalls)), 'f1': float(np.mean(f1s))}

def accuracy_precision_recall_f1(y_true, y_pred, average='macro'):
    acc = accuracy(y_true, y_pred)
    prf = precision_recall_f1(y_true, y_pred, average=average)
    return {'accuracy':acc, **prf} if average else {'accuracy':acc,'per_class':prf}
