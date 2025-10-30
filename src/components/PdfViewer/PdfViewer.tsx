import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Group, Transformer, Image as KonvaImage, Line } from 'react-konva';
import Konva from 'konva';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  setPages,
  addSeal,
  updateSeal,
  setSelectedItem,
  setCurrentPage,
} from '../../store/pdfSlice';
import { loadPdfPages } from '../../utils/pdfUtils';
import { registerBrightenGradientFilter } from '../../utils/customFilters';
import { fitToPage } from '../../utils/fitToPage';
import { getRandomPalette } from '../../utils/palette';

import '../../styles/PDFViewer.scss';

registerBrightenGradientFilter();

const mmToPx = (mm: number): number => (mm / 25.4) * 96;

const PDFViewer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    pages,
    seals,
    currentPage,
    selectedItem,
    selectedDocument,
    selectedEffects,
    rotation,
    orientation,
  } = useSelector((state: RootState) => state.pdf);

  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const groupRef = useRef<Konva.Group>(null);
  const imgRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [selectedNode, setSelectedNode] = useState<Konva.Node | null>(null);
  const [pageSize, setPageSize] = useState({ width: mmToPx(210), height: mmToPx(297) });
  const previewScale = 0.8;
  const palette = useMemo(() => getRandomPalette(), []);
  const { main, accents } = palette;

  // ориентация страницы
  useEffect(() => {
    setPageSize(
      orientation === 'album'
        ? { width: mmToPx(297), height: mmToPx(210) }
        : { width: mmToPx(210), height: mmToPx(297) }
    );
  }, [orientation]);

  // загрузка PDF
  useEffect(() => {
    if (!selectedDocument?.url) return;
    (async () => {
      const loaded = await loadPdfPages(selectedDocument.url, 2);
      dispatch(setPages(loaded));
      dispatch(setCurrentPage(0));
    })();
  }, [selectedDocument]);

  // fitToPage
  useEffect(() => {
    if (!pages?.length) return;
    const updated = pages.map((p) => {
      if (!p.image) return p;
      const layout = fitToPage(p.image.width, p.image.height, pageSize.width, pageSize.height);
      return { ...p, layout };
    });
    dispatch(setPages(updated));
  }, [pageSize]);

  // фильтры
  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    const filters: any[] = [];
    if (selectedEffects.includes('scan1')) filters.push(Konva.Filters.BrightenGradient);
    if (selectedEffects.includes('scan2')) {
      filters.push(Konva.Filters.Grayscale, Konva.Filters.Contrast);
      node.contrast(0.2);
    }
    node.filters(filters);
    node.getLayer()?.batchDraw();
  }, [selectedEffects]);

  // трансформер
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    tr.nodes(selectedNode ? [selectedNode] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedNode]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('asset');
    if (!raw) return;
    let asset;
    try {
      asset = JSON.parse(raw);
    } catch {
      console.warn('Invalid drag data');
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.container().getBoundingClientRect();
    const stageX = (e.clientX - box.left) / previewScale;
    const stageY = (e.clientY - box.top) / previewScale;

    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = asset.url;
    img.onload = () => {
      const aspect = img.height / img.width;
      const width = asset.type === 'stamp' ? mmToPx(40) : 150;
      const height = asset.type === 'stamp' ? width : width * aspect;

      const newSeal = {
        id: Date.now(),
        assetId: asset.id,
        url: asset.url,
        name: asset.name,
        page: currentPage,
        type: asset.type,
        x: stageX - width / 2,
        y: stageY - height / 2,
        width,
        height,
        rotation: 0,
        _customSize: false,
      };
      dispatch(addSeal(newSeal));
      dispatch(setSelectedItem(newSeal));
    };
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  if (!pages[currentPage])
    return (
      <div className="pdf-viewer__placeholder">
        <p>Загрузка...</p>
      </div>
    );

  const page = pages[currentPage];
  const layout =
    page.layout ||
    (page.image
      ? fitToPage(page.image.width, page.image.height, pageSize.width, pageSize.height)
      : { width: pageSize.width, height: pageSize.height, offsetX: 0, offsetY: 0 });

  return (
    <div className="pdf-viewer" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="pdf-viewer__stage-wrapper">
        <Stage
          width={pageSize.width * previewScale}
          height={pageSize.height * previewScale}
          scale={{ x: previewScale, y: previewScale }}
          ref={stageRef}
          onClick={(e) => {
            if (e.target === stageRef.current || e.target.name() !== 'seal') {
              setSelectedNode(null);
              dispatch(setSelectedItem(null));
            }
          }}
        >
          <Layer ref={layerRef} globalCompositeOperation="multiply">
            <Group
              ref={groupRef}
              x={pageSize.width / 2}
              y={pageSize.height / 2}
              rotation={rotation}
            >
              <KonvaImage
                image={page.image}
                ref={imgRef}
                x={-layout.width / 2}
                y={-layout.height / 2}
                width={layout.width}
                height={layout.height}
                crossOrigin="anonymous"
                cache
              />
            </Group>

            {seals
              .filter((s) => s.page === currentPage)
              .map((s) => (
                <SealImage
                  key={s.id}
                  seal={s}
                  onClick={(node) => {
                    dispatch(setSelectedItem(s));
                    setSelectedNode(node);
                  }}
                  onUpdate={(updatedSeal) => dispatch(updateSeal(updatedSeal))}
                />
              ))}

            <Transformer
              ref={trRef}
              rotateEnabled
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            />
          </Layer>

          {selectedEffects.includes('sideArtifact') && (
            <Layer globalCompositeOperation="multiply">
              {Array.from({ length: 8 }).map((_, i) => {
                const color = i % 3 === 0 ? accents[i % accents.length] : main;
                const isAlbum = orientation === 'album';
                return (
                  <Line
                    key={i}
                    points={
                      isAlbum
                        ? [8, 1.3 * i + 8, pageSize.width, 1.3 * i + 8]
                        : [1.3 * i + 8, 8, 1.3 * i + 8, pageSize.height]
                    }
                    stroke={color}
                    strokeWidth={1.1}
                    filters={[Konva.Filters.Noise, Konva.Filters.Contrast]}
                    noise={100}
                    contrast={100}
                  />
                );
              })}
            </Layer>
          )}
        </Stage>
      </div>

      <div className="pdf-viewer__thumbnail-bar">
        {pages.map((p, idx) => (
          <img
            key={idx}
            src={p.image.src}
            alt={`page ${idx + 1}`}
            className={idx === currentPage ? 'active' : ''}
            onClick={() => dispatch(setCurrentPage(idx))}
          />
        ))}
      </div>
    </div>
  );
};

interface SealImageProps {
  seal: any;
  onClick: (node: Konva.Image) => void;
  onUpdate: (updatedSeal: any) => void;
}

const SealImage: React.FC<SealImageProps> = ({ seal, onClick, onUpdate }) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const nodeRef = useRef<Konva.Image>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = seal.url;
    img.onload = () => setImageObj(img);
  }, [seal.url]);

  return (
    <KonvaImage
      ref={nodeRef}
      name="seal"
      image={imageObj}
      x={seal.x}
      y={seal.y}
      width={seal.width}
      height={seal.height}
      rotation={seal.rotation}
      draggable
      globalCompositeOperation="multiply"
      onClick={() => nodeRef.current && onClick(nodeRef.current)}
      onDragEnd={(e) => onUpdate({ ...seal, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const newWidth = Math.max(5, node.width() * node.scaleX());
        const newHeight = Math.max(5, node.height() * node.scaleY());
        node.width(newWidth);
        node.height(newHeight);
        node.scale({ x: 1, y: 1 });
        node.cache();
        node.getLayer()?.batchDraw();
        onUpdate({ ...seal, width: newWidth, height: newHeight, rotation: node.rotation() });
      }}
    />
  );
};

export default PDFViewer;
