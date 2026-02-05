"""
Video Processing Service for coconut tree analysis
Extracts frames from video, performs segmentation, and generates statistics
"""

import cv2
import numpy as np
import os
import sys
import tempfile
from typing import Dict, List, Tuple
import json

# Handle relative imports
try:
    from .segmentation import TreeSegmenter
except ImportError:
    from segmentation import TreeSegmenter


class VideoAnalyzer:
    """Analyzes video files for tree detection and disease classification"""
    
    def __init__(self, config_path: str = None):
        """Initialize video analyzer with segmenter"""
        self.segmenter = TreeSegmenter(config_path)
        self.frame_skip = 5  # Process every Nth frame to improve speed
    
    def extract_frames_from_video(self, video_path: str, max_frames: int = None) -> List[np.ndarray]:
        """
        Extract frames from video file
        
        Args:
            video_path: Path to video file
            max_frames: Maximum number of frames to extract (None for all)
        
        Returns:
            List of frame arrays
        """
        frames = []
        
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                raise ValueError(f"Could not open video file: {video_path}")
            
            frame_count = 0
            skip_count = 0
            
            while True:
                ret, frame = cap.read()
                
                if not ret:
                    break
                
                # Skip frames for efficiency
                if skip_count % self.frame_skip == 0:
                    frames.append(frame)
                    frame_count += 1
                    
                    if max_frames and frame_count >= max_frames:
                        break
                
                skip_count += 1
            
            cap.release()
            
            if not frames:
                raise ValueError("No frames extracted from video")
            
            return frames
        
        except Exception as e:
            raise Exception(f"Error extracting frames: {str(e)}")
    
    def analyze_video(self, video_path: str, max_frames: int = 30) -> Dict:
        """
        Complete video analysis pipeline
        
        Args:
            video_path: Path to video file
            max_frames: Maximum frames to process
        
        Returns:
            Dictionary with analysis results
        """
        # Extract frames
        frames = self.extract_frames_from_video(video_path, max_frames)
        
        # Aggregate statistics across frames
        all_tree_counts = []
        all_disease_counts = {}
        all_health_percentages = []
        all_farm_sizes = []
        all_centroids = []
        
        # Process each frame
        for frame in frames:
            result = self.segmenter.process_frame(frame)
            
            all_tree_counts.append(result['num_trees'])
            all_health_percentages.append(result['health_percentage'])
            all_farm_sizes.append(result['farm_size'])
            all_centroids.extend(result['centroids'])
            
            # Aggregate disease counts
            for disease, count in result['disease_counts'].items():
                all_disease_counts[disease] = all_disease_counts.get(disease, 0) + count
        
        # Calculate aggregated statistics
        avg_tree_count = int(np.mean(all_tree_counts)) if all_tree_counts else 0
        max_tree_count = int(np.max(all_tree_counts)) if all_tree_counts else 0
        avg_health = np.mean(all_health_percentages) if all_health_percentages else 0
        avg_farm_size = np.mean(all_farm_sizes) if all_farm_sizes else 0
        
        # Normalize disease counts to percentage of max detections
        normalized_diseases = {}
        if all_disease_counts:
            total_detections = sum(all_disease_counts.values())
            for disease, count in all_disease_counts.items():
                normalized_diseases[disease] = int((count / total_detections) * 100)
        
        # Count healthy and diseased from aggregated disease counts
        healthy_trees = all_disease_counts.get('Healthy', 0)
        diseased_trees = sum(all_disease_counts.values()) - healthy_trees
        
        return {
            'coconut_trees_found': avg_tree_count,
            'max_trees_in_frame': max_tree_count,
            'farm_size': round(avg_farm_size, 2),
            'farm_size_unit': 'hectares',
            'healthy_trees': healthy_trees,
            'diseased_trees': diseased_trees,
            'tree_health_percentage': round(avg_health, 2),
            'disease_breakdown': all_disease_counts,
            'disease_percentage_breakdown': normalized_diseases,
            'canopy_density': round(avg_health, 2),  # Approximation based on health
            'frames_processed': len(frames),
            'analysis_complete': True
        }
    
    def analyze_video_with_output(self, video_path: str, output_dir: str = None, 
                                   max_frames: int = 30) -> Tuple[Dict, List[str]]:
        """
        Analyze video and optionally save annotated frames
        
        Args:
            video_path: Path to video file
            output_dir: Directory to save annotated frames (optional)
            max_frames: Maximum frames to process
        
        Returns:
            Tuple of (analysis results, list of output file paths)
        """
        frames = self.extract_frames_from_video(video_path, max_frames)
        
        output_paths = []
        all_tree_counts = []
        all_disease_counts = {}
        all_health_percentages = []
        all_farm_sizes = []
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Process each frame
        for idx, frame in enumerate(frames):
            result = self.segmenter.process_frame(frame)
            
            all_tree_counts.append(result['num_trees'])
            all_health_percentages.append(result['health_percentage'])
            all_farm_sizes.append(result['farm_size'])
            
            # Aggregate disease counts
            for disease, count in result['disease_counts'].items():
                all_disease_counts[disease] = all_disease_counts.get(disease, 0) + count
            
            # Save annotated frame if output directory specified
            if output_dir:
                output_path = os.path.join(output_dir, f"frame_segmented_{idx:04d}.jpg")
                cv2.imwrite(output_path, result['labeled_frame'])
                output_paths.append(output_path)
        
        # Calculate aggregated statistics
        avg_tree_count = int(np.mean(all_tree_counts)) if all_tree_counts else 0
        avg_health = np.mean(all_health_percentages) if all_health_percentages else 0
        avg_farm_size = np.mean(all_farm_sizes) if all_farm_sizes else 0
        
        healthy_trees = all_disease_counts.get('Healthy', 0)
        diseased_trees = sum(all_disease_counts.values()) - healthy_trees
        
        results = {
            'coconut_trees_found': avg_tree_count,
            'farm_size': round(avg_farm_size, 2),
            'farm_size_unit': 'hectares',
            'healthy_trees': healthy_trees,
            'diseased_trees': diseased_trees,
            'tree_health_percentage': round(avg_health, 2),
            'disease_breakdown': all_disease_counts,
            'canopy_density': round(avg_health, 2),
            'frames_processed': len(frames),
            'output_frames_saved': len(output_paths)
        }
        
        return results, output_paths


def analyze_video_file(video_path: str, config_path: str = None) -> Dict:
    """
    Convenience function to analyze a video file
    
    Args:
        video_path: Path to video file
        config_path: Path to config (optional)
    
    Returns:
        Analysis results dictionary
    """
    analyzer = VideoAnalyzer(config_path)
    return analyzer.analyze_video(video_path)
