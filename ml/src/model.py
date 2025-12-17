import os
from typing import Optional
import torch
import torch.nn as nn
import torchvision.models as models

def create_backbone(model_name: str = 'resnet50', pretrained: bool = True):
    name = model_name.lower()
    if name.startswith('resnet'):
        m = {'resnet18': models.resnet18, 'resnet34': models.resnet34}.get(name, models.resnet50)(pretrained=pretrained)
        return m, 'resnet'
    if name.startswith('efficientnet'):
        m = models.efficientnet_b0(pretrained=pretrained)
        return m, 'efficientnet'
    return models.resnet50(pretrained=pretrained), 'resnet'

class MyModel(nn.Module):
    def __init__(self, num_classes: int, model_name: str = 'resnet50', pretrained: bool = True):
        super().__init__()
        backbone, kind = create_backbone(model_name, pretrained=pretrained)
        self.backbone = backbone
        self.kind = kind

        if kind == 'resnet':
            in_features = self.backbone.fc.in_features
            self.backbone.fc = nn.Linear(in_features, num_classes)
        elif kind == 'efficientnet':
            in_features = self.backbone.classifier[1].in_features
            self.backbone.classifier[1] = nn.Linear(in_features, num_classes)

    def forward(self, x):
        return self.backbone(x)

def load_weights(model: nn.Module, path: str, map_location: Optional[str] = None) -> nn.Module:
    import os
    if map_location is None:
        map_location = 'cpu'
    if not path or not os.path.exists(path):
        raise FileNotFoundError(f'Weights file not found: {path}')
    data = torch.load(path, map_location=map_location)
    if isinstance(data, dict):
        model.load_state_dict(data)
    else:
        model = data
    return model
