import os
from typing import Optional
import torch
import torch.nn as nn
import torchvision.models as models


def create_backbone(model_name: str = 'efficientnet_b3', pretrained: bool = True):
    name = model_name.lower()

    if name == 'efficientnet_b3':
        weights = models.EfficientNet_B3_Weights.IMAGENET1K_V1 if pretrained else None
        m = models.efficientnet_b3(weights=weights)
        return m, 'efficientnet_b3'

    if name == 'efficientnet_b0':
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        m = models.efficientnet_b0(weights=weights)
        return m, 'efficientnet_b0'

    if name == 'efficientnet_b4':
        weights = models.EfficientNet_B4_Weights.IMAGENET1K_V1 if pretrained else None
        m = models.efficientnet_b4(weights=weights)
        return m, 'efficientnet_b4'

    if name.startswith('resnet'):
        name_map = {
            'resnet18': (models.resnet18, models.ResNet18_Weights.IMAGENET1K_V1),
            'resnet34': (models.resnet34, models.ResNet34_Weights.IMAGENET1K_V1),
            'resnet50': (models.resnet50, models.ResNet50_Weights.IMAGENET1K_V1),
        }
        fn, w = name_map.get(name, (models.resnet50, models.ResNet50_Weights.IMAGENET1K_V1))
        m = fn(weights=w if pretrained else None)
        return m, 'resnet'

    # Default fallback: EfficientNet-B3
    weights = models.EfficientNet_B3_Weights.IMAGENET1K_V1 if pretrained else None
    return models.efficientnet_b3(weights=weights), 'efficientnet_b3'


class MyModel(nn.Module):
    def __init__(self, num_classes: int, model_name: str = 'efficientnet_b3', pretrained: bool = True, dropout: float = 0.3):
        super().__init__()
        backbone, kind = create_backbone(model_name, pretrained=pretrained)
        self.backbone = backbone
        self.kind = kind

        if kind in ('efficientnet_b3', 'efficientnet_b0', 'efficientnet_b4'):
            in_features = self.backbone.classifier[1].in_features
            self.backbone.classifier = nn.Sequential(
                nn.Dropout(p=dropout, inplace=True),
                nn.Linear(in_features, num_classes)
            )
        elif kind == 'resnet':
            in_features = self.backbone.fc.in_features
            self.backbone.fc = nn.Sequential(
                nn.Dropout(p=dropout),
                nn.Linear(in_features, num_classes)
            )

    def forward(self, x):
        return self.backbone(x)

    def freeze_backbone(self):
        """Freeze all backbone parameters except the classifier head."""
        for name, param in self.backbone.named_parameters():
            if 'classifier' not in name and 'fc' not in name:
                param.requires_grad = False
        print("[FROZEN] Backbone frozen (only classifier head is trainable)")

    def unfreeze_backbone(self):
        """Unfreeze all backbone parameters for full fine-tuning."""
        for param in self.backbone.parameters():
            param.requires_grad = True
        print("[UNFROZEN] Backbone unfrozen (all parameters are trainable)")

    def get_trainable_params(self):
        """Return count of trainable vs total parameters."""
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return trainable, total


def load_weights(model: nn.Module, path: str, map_location: Optional[str] = None) -> nn.Module:
    if map_location is None:
        map_location = 'cpu'
    if not path or not os.path.exists(path):
        raise FileNotFoundError(f'Weights file not found: {path}')
    data = torch.load(path, map_location=map_location)
    if isinstance(data, dict):
        # Strip 'module.' prefix if saved with DataParallel
        state = {k.replace('module.', ''): v for k, v in data.items()}
        model.load_state_dict(state, strict=True)
    else:
        model = data
    return model
