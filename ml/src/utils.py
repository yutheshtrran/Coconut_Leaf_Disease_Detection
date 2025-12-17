import os, torch
from typing import Union, Tuple, List
from torchvision import transforms
from PIL import Image
import torch.nn.functional as F
from model import MyModel, load_weights

def load_config(path=None): 
    import yaml
    path = path or os.path.join(os.path.dirname(__file__),'config.yaml')
    try:
        with open(path,'r') as f: cfg=yaml.safe_load(f)
    except: cfg={}
    return cfg or {}

def load_class_names(cfg): 
    for key in ('class_names','labels','classes'):
        if key in cfg: return list(cfg[key])
    return ['healthy','leaf_spot','powdery_mildew','rust','wilt']

def get_image_size(cfg): 
    size=cfg.get('image_size')
    if isinstance(size,(list,tuple)) and len(size)==2: return int(size[0]),int(size[1])
    if isinstance(size,int): return size,size
    return 224,224

def preprocess_image(img_input: Union[str, Image.Image, bytes], image_size: Tuple[int,int]):
    if isinstance(img_input,(bytes,bytearray)):
        import io
        img=Image.open(io.BytesIO(img_input)).convert('RGB')
    elif isinstance(img_input,Image.Image): img=img_input.convert('RGB')
    else: img=Image.open(img_input).convert('RGB')
    preprocess=transforms.Compose([
        transforms.Resize(image_size),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
    ])
    return preprocess(img).unsqueeze(0)

def severity_from_confidence(conf:float)->str:
    if conf>=0.8: return 'High'
    if conf>=0.5: return 'Medium'
    return 'Low'

def infer(img:Union[str, Image.Image, bytes], model_path:str, config_path:str=None, device=None):
    cfg = load_config(config_path)
    class_names = load_class_names(cfg)
    image_size = get_image_size(cfg)
    device = device or (torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu'))
    # load model with MyModel wrapper
    model = MyModel(num_classes=len(class_names))
    model = load_weights(model, model_path, map_location=device)
    model.to(device).eval()
    tensor = preprocess_image(img, image_size).to(device)
    with torch.no_grad():
        out = model(tensor)
        if isinstance(out,(tuple,list)): out=out[0]
        probs = F.softmax(out.squeeze(0), dim=0)
    conf_val, idx = torch.max(probs,dim=0)
    predicted_label = class_names[idx.item()] if idx.item()<len(class_names) else str(idx.item())
    return {
        'predicted_class': predicted_label,
        'confidence': float(conf_val.item()),
        'severity_level': severity_from_confidence(conf_val.item()),
        'raw_scores': probs.cpu().numpy().tolist()
    }
