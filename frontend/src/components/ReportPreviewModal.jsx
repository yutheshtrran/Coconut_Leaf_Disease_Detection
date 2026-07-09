import React, { useState, useEffect, useRef } from 'react';
import {
  X, Download, Loader2, Calendar, MapPin, AlertTriangle,
  Mail, CheckCircle, AlertCircle, Leaf, Video, Image as ImageIcon,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import API from '../services/api';
import DISEASE_DB from '../data/diseases.json';

// ── Palettes ───────────────────────────────────────────────────────────────
const DISEASE_PALETTE = {
  'Healthy':               { stroke: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  'Black Beetle Attack':   { stroke: '#dc2626', bg: '#fff1f2', border: '#fecdd3', text: '#b91c1c' },
  'Magnesium Deficiency':  { stroke: '#9333ea', bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
  'Potassium Deficiency':  { stroke: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  'Yellow Patches':        { stroke: '#ca8a04', bg: '#fefce8', border: '#fef08a', text: '#a16207' },
};
const dp = (name) => DISEASE_PALETTE[name] || { stroke: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', text: '#374151' };
const dStroke = (name) => dp(name).stroke;

const TYPE_LABEL = {
  'leaf':        'Leaf Image Analysis',
  'drone-image': 'Drone Image Analysis',
  'drone-video': 'Drone Video Analysis',
};
const TYPE_ICON = { 'leaf': Leaf, 'drone-image': ImageIcon, 'drone-video': Video };

const SEV_STYLE = {
  CRITICAL: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', bar: '#ef4444' },
  HIGH:     { bg: '#fff7ed', text: '#9a3412', border: '#fdba74', bar: '#f97316' },
  MODERATE: { bg: '#fefce8', text: '#854d0e', border: '#fde047', bar: '#eab308' },
  LOW:      { bg: '#f0fdf4', text: '#166534', border: '#86efac', bar: '#22c55e' },
};
const sev = (label) => SEV_STYLE[label?.toUpperCase()] || SEV_STYLE.LOW;

const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (typeof user === 'string') return user;
  const name = user.name || user.fullName;
  if (name?.trim()) return name.trim();
  const first = user.firstName, last = user.lastName;
  if (first?.trim() || last?.trim()) return `${first || ''} ${last || ''}`.trim();
  if (user.email?.includes('@')) {
    return user.email.split('@')[0].replace(/[._]/g, ' ')
      .split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  return 'Unknown';
};

// ── Map with SVG overlay ────────────────────────────────────────────────────
function FarmMapSection({ ad }) {
  if (!ad.mapImage || !ad.treesForMap?.length) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ width: 3, height: 18, backgroundColor: '#0891b2', borderRadius: 2 }} />
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Farm Orthomosaic Map
        </h2>
        <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>
          {ad.treesForMap.length} trees detected
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        {Object.entries(DISEASE_PALETTE).map(([name, p]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: p.stroke }} />
            <span style={{ fontSize: 10, color: '#374151' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Map image + SVG overlay */}
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <img
          src={ad.mapImage}
          alt="Farm orthomosaic map"
          crossOrigin="anonymous"
          style={{ width: '100%', display: 'block' }}
        />
        <svg
          viewBox={`0 0 100 ${(ad.mapHeight && ad.mapWidth) ? (ad.mapHeight / ad.mapWidth) * 100 : 56.25}`}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          preserveAspectRatio="none"
        >
          {ad.treesForMap.map(t => {
            const color = dStroke(t.disease || '');
            return (
              <g key={t.tree_id}>
                <circle
                  cx={t.cx_pct}
                  cy={t.cy_pct}
                  r="1.6"
                  fill={color}
                  stroke="white"
                  strokeWidth="0.4"
                  opacity="0.92"
                />
                <text
                  x={t.cx_pct}
                  y={t.cy_pct + 0.55}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: '1px', fontWeight: 700, fill: '#fff', fontFamily: 'system-ui,sans-serif' }}
                >
                  {t.tree_id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

// ── Tree Gallery (all trees, or affected-only fallback) ───────────────────
function AffectedTreesSection({ ad }) {
  const trees = ad.allTrees?.length ? ad.allTrees : ad.affectedTrees;
  if (!trees?.length) return null;
  const showAll = !!ad.allTrees?.length;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ width: 3, height: 18, backgroundColor: showAll ? '#0891b2' : '#dc2626', borderRadius: 2 }} />
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          {showAll ? 'Individual Tree Analysis' : 'Affected Trees — Individual Analysis'}
        </h2>
        <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>
          {trees.length} tree{trees.length !== 1 ? 's' : ''}{showAll ? ' detected' : ' requiring attention'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 10,
      }}>
        {trees.map((t, idx) => {
          const p    = dp(t.disease);
          const conf = Math.round((t.disease_confidence ?? 0) * 100);
          const label = t.tree_id != null ? `#${t.tree_id}` : `#${idx + 1}`;
          return (
            <div key={t.tree_id ?? idx} style={{
              borderRadius: 8,
              border: `1.5px solid ${p.border}`,
              overflow: 'hidden',
              backgroundColor: '#fff',
            }}>
              {/* Crop image */}
              <div style={{ position: 'relative', backgroundColor: '#f3f4f6' }}>
                <img
                  src={t.crop_image}
                  alt={`Tree ${label}`}
                  crossOrigin="anonymous"
                  style={{ width: '100%', display: 'block' }}
                />
                {/* Tree number badge */}
                <div style={{
                  position: 'absolute', top: 5, left: 5,
                  backgroundColor: p.stroke,
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 800,
                  borderRadius: 4,
                  padding: '2px 5px',
                  lineHeight: 1.2,
                }}>
                  {label}
                </div>
                {/* Confidence badge — only when not Healthy */}
                {t.disease !== 'Healthy' && (
                  <div style={{
                    position: 'absolute', bottom: 5, right: 5,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 4,
                    padding: '2px 5px',
                  }}>
                    {conf}%
                  </div>
                )}
              </div>

              {/* Label */}
              <div style={{
                padding: '6px 8px',
                backgroundColor: p.bg,
                borderTop: `1px solid ${p.border}`,
              }}>
                <p style={{
                  margin: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  color: p.text,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}>
                  {t.disease}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Rich Disease Details ───────────────────────────────────────────────────
function DiseaseDetailSection({ diseases }) {
  if (!diseases?.length) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ width: 3, height: 18, backgroundColor: '#dc2626', borderRadius: 2 }} />
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Disease Breakdown &amp; Treatment
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {diseases.map((d, i) => {
          const p    = dp(d.name);
          const pct  = d.percentage ?? 0;
          const conf = Math.round((d.topConfidence ?? 0) * 100);
          const db   = DISEASE_DB[d.name];

          return (
            <div key={i} style={{
              borderRadius: 8,
              border: `1px solid ${p.border}`,
              overflow: 'hidden',
            }}>
              {/* ── Disease header ── */}
              <div style={{ backgroundColor: p.bg, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: p.stroke, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{d.name}</span>
                      {db?.type && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 9,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          padding: '1px 6px',
                          borderRadius: 3,
                          backgroundColor: p.border,
                          color: p.text,
                        }}>
                          {db.type}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#4b5563' }}>
                      <strong>{d.count}</strong> tree{d.count !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: '#4b5563' }}>
                      <strong>{pct}%</strong> of sample
                    </span>
                    <span style={{ fontSize: 11, color: '#4b5563' }}>
                      Peak conf: <strong>{conf}%</strong>
                    </span>
                  </div>
                </div>

                {/* Confidence bar */}
                <div style={{ height: 5, backgroundColor: '#ffffff', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: p.stroke, borderRadius: 3 }} />
                </div>

                {d.description && (
                  <p style={{ fontSize: 11, color: '#374151', margin: 0, lineHeight: 1.6 }}>{d.description}</p>
                )}
              </div>

              {/* ── Causes & Symptoms from DB ── */}
              {db && (
                <div style={{ backgroundColor: '#fafafa', padding: '10px 16px', borderTop: `1px solid ${p.border}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {db.causes?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Causes
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 14 }}>
                          {db.causes.map((c, ci) => (
                            <li key={ci} style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.6 }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {db.symptoms?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Symptoms
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 14 }}>
                          {db.symptoms.map((s, si) => (
                            <li key={si} style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.6 }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Remedies ── */}
              {db?.remedies?.length > 0 ? (
                <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderTop: `1px solid ${p.border}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✅ Recommended Treatment
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {db.remedies.map((rem, ri) => (
                      <div key={ri}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: p.text, margin: '0 0 3px' }}>{rem.category}</p>
                        <ul style={{ margin: 0, paddingLeft: 14 }}>
                          {rem.steps.map((step, si) => (
                            <li key={si} style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.6 }}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {db.references?.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${p.border}` }}>
                      <p style={{ fontSize: 9, fontWeight: 600, color: '#9ca3af', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</p>
                      {db.references.map((ref, ri) => (
                        <p key={ri} style={{ fontSize: 9, color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>{ref}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : d.remedy ? (
                <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderTop: `1px solid ${p.border}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#374151', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✅ Recommended Treatment
                  </p>
                  <p style={{ fontSize: 11, color: '#4b5563', margin: 0, lineHeight: 1.6 }}>{d.remedy}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Inner: the printable document (always light) ───────────────────────────
function ReportDocument({ report }) {
  const ad = report.analysisData;
  const TypeIcon = ad ? (TYPE_ICON[ad.analysisType] || Leaf) : null;
  const healthy = ad?.healthyPercent ?? 0;
  const r = 30, circ = 2 * Math.PI * r, dash = (healthy / 100) * circ;
  const sevStyle = sev(report.severity?.label);
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const reportDate = new Date(report.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      backgroundColor: '#ffffff',
      color: '#111827',
      lineHeight: 1.5,
    }}>

      {/* ── Header band ────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)',
        padding: '28px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🥥</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
              Coco<span style={{ color: '#86efac' }}>Guard</span>
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#bbf7d0', margin: 0, letterSpacing: '0.5px' }}>
            AGRICULTURAL DISEASE DETECTION &amp; MANAGEMENT SYSTEM
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: '#86efac', margin: '0 0 4px', letterSpacing: '1px', fontWeight: 600 }}>REPORT ID</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>{report.reportId}</p>
          <p style={{ fontSize: 10, color: '#d1fae5', margin: 0 }}>Generated: {now}</p>
        </div>
      </div>

      {/* ── Thin accent bar ────────────────────────────────────────────── */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #22c55e, #86efac, #22c55e)' }} />

      {/* ── Meta row ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
        borderBottom: '1px solid #e5e7eb',
      }}>
        {[
          { icon: '📍', label: 'Farm / Location', value: report.farm },
          { icon: '📅', label: 'Assessment Date', value: reportDate },
          { icon: '🔬', label: 'Analysis Type',   value: ad ? (TYPE_LABEL[ad.analysisType] || ad.analysisType) : '—' },
          {
            icon: '⚠️', label: 'Severity', value: null,
            custom: (
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 4,
                fontSize: 12, fontWeight: 700,
                backgroundColor: sevStyle.bg, color: sevStyle.text, border: `1px solid ${sevStyle.border}`,
              }}>
                {report.severity?.value ?? 0}% {report.severity?.label ?? '—'}
              </span>
            ),
          },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '16px 20px',
            borderRight: i < 3 ? '1px solid #e5e7eb' : 'none',
            backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb',
          }}>
            <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 6px', letterSpacing: '0.8px', fontWeight: 600, textTransform: 'uppercase' }}>
              {item.icon} {item.label}
            </p>
            {item.custom
              ? item.custom
              : <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{item.value}</p>
            }
          </div>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '28px 36px' }}>

        {/* ── Analysis Summary ─────────────────────────────────────────── */}
        {ad && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
              <div style={{ width: 3, height: 18, backgroundColor: '#16a34a', borderRadius: 2 }} />
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Analysis Summary
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Health ring */}
              <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle cx="40" cy="40" r={r} fill="none" stroke="#16a34a" strokeWidth="8"
                    strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
                </svg>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)', textAlign: 'center',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>{healthy}%</span>
                </div>
              </div>

              {/* Stat chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flex: 1 }}>
                {[
                  { label: 'Healthy',          value: `${healthy}%`,              bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
                  { label: 'Trees Analysed',   value: ad.totalImages ?? 0,        bg: '#f8fafc', border: '#e2e8f0', text: '#334155' },
                  ...(ad.treeSummary ? [
                    { label: 'Total Trees',    value: ad.treeSummary.total,        bg: '#f8fafc', border: '#e2e8f0', text: '#334155' },
                    { label: 'At Risk',        value: ad.treeSummary.atRisk,       bg: '#fff1f2', border: '#fecdd3', text: '#b91c1c' },
                    { label: 'Healthy Trees',  value: ad.treeSummary.healthy,      bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
                  ] : []),
                ].map((chip, i) => (
                  <div key={i} style={{
                    padding: '10px 16px', borderRadius: 8, border: `1px solid ${chip.border}`,
                    backgroundColor: chip.bg, textAlign: 'center', minWidth: 90,
                  }}>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{chip.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: chip.text, margin: 0 }}>{chip.value}</p>
                  </div>
                ))}

                {/* GPS */}
                {ad.gps?.lat != null && (
                  <div style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #bae6fd', backgroundColor: '#f0f9ff', alignSelf: 'center' }}>
                    <p style={{ fontSize: 10, color: '#0369a1', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 GPS Location</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#0c4a6e', margin: 0 }}>
                      {ad.gps.lat.toFixed(5)}°N, {ad.gps.lon.toFixed(5)}°E
                    </p>
                    {ad.gps.source && (
                      <p style={{ fontSize: 10, color: '#0369a1', margin: '2px 0 0' }}>
                        {ad.gps.source === 'video' ? 'Extracted from video' : 'Manually pinned'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Farm Map with tree overlays ───────────────────────────────── */}
        {ad && <FarmMapSection ad={ad} />}

        {/* ── Disease Breakdown & Treatment ─────────────────────────────── */}
        {ad?.diseases?.length > 0 && <DiseaseDetailSection diseases={ad.diseases} />}

        {/* ── Affected Trees Gallery ────────────────────────────────────── */}
        {ad && <AffectedTreesSection ad={ad} />}

        {/* ── Detection Evidence (AI-annotated full images for leaf/drone-image) ── */}
        {ad?.annotatedImages?.length > 0 && ad.analysisType !== 'drone-video' && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
              <div style={{ width: 3, height: 18, backgroundColor: '#0284c7', borderRadius: 2 }} />
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Detection Evidence
              </h2>
              <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>AI-annotated images</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ad.annotatedImages.map((src, i) => (
                <div key={i} style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', backgroundColor: '#f9fafb' }}>
                  <img
                    src={src} alt={`Detection sample ${i + 1}`}
                    crossOrigin="anonymous"
                    style={{ width: '100%', display: 'block' }}
                  />
                  {ad.annotatedImages.length > 1 && (
                    <p style={{ fontSize: 10, color: '#6b7280', margin: 0, padding: '6px 8px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>
                      Image {i + 1}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Report Status ─────────────────────────────────────────────── */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
            <div style={{ width: 3, height: 18, backgroundColor: '#6b7280', borderRadius: 2 }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Report Status
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '14px 18px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Current Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: report.status === 'Finalized' ? '#16a34a' : '#d97706' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: report.status === 'Finalized' ? '#166534' : '#92400e' }}>
                  {report.status}
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0' }}>
                Updated: {new Date(report.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div style={{ padding: '14px 18px', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Assessed By</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{getUserDisplayName(report.userId)}</p>
              {report.userId?.email && (
                <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0' }}>✉ {report.userId.email}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Timestamps ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          {[
            { label: 'Report Created', value: new Date(report.createdAt).toLocaleString('en-GB') },
            { label: 'Last Modified',  value: new Date(report.updatedAt).toLocaleString('en-GB') },
          ].map((ts, i) => (
            <div key={i}>
              <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{ts.label}</p>
              <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>{ts.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
        padding: '16px 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', margin: '0 0 2px', letterSpacing: '0.5px' }}>COCOGUARD AGRICULTURAL MANAGEMENT SYSTEM</p>
          <p style={{ fontSize: 10, color: '#bbf7d0', margin: 0 }}>This is an official automated assessment generated by AI-powered disease detection.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: '#86efac', margin: '0 0 2px' }}>© 2026 CocoGuard</p>
          <p style={{ fontSize: 10, color: '#d1fae5', margin: 0 }}>Confidential Agricultural Report</p>
        </div>
      </div>

    </div>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────────────
const ReportPreviewModal = ({ reportId, onClose, autoDownload = false, onAutoDownloadComplete }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef(null);
  const autoTriggered = useRef(false);

  useEffect(() => { fetchReport(); }, [reportId]);

  const fetchReport = async () => {
    try {
      setLoading(true); setError(null);
      const res = await API.get(`/reports/${reportId}/preview`);
      setReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (closeAfter = false) => {
    if (!contentRef.current) return;
    setDownloading(true);
    try {
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `${report?.reportId || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(contentRef.current).save();
      if (closeAfter) onAutoDownloadComplete?.();
    } catch (err) {
      setError('Download failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!autoDownload) { autoTriggered.current = false; return; }
    if (!report || loading || error || downloading || autoTriggered.current) return;
    autoTriggered.current = true;
    handleDownload(true);
  }, [autoDownload, report, loading, error, downloading]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Modal chrome */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-lg">📋</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Report Preview</h2>
              {report && <p className="text-xs text-gray-400">{report.reportId} · {report.farm}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload(false)}
              disabled={downloading || loading || !!error}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
                : <><Download className="w-4 h-4" /> Download PDF</>
              }
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-green-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading report…</p>
            </div>
          ) : error ? (
            <div className="m-6 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="font-semibold text-red-700 dark:text-red-400">Failed to load report</p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          ) : report ? (
            <div ref={contentRef}>
              <ReportDocument report={report} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ReportPreviewModal;
