import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { CATEGORIES, searchLibrary, type CategoryId, type LibraryAsset } from '@core/library/catalog';
import { placeGroup, TEMPLATES } from '@core/library/place';
import type { Project } from '@core/model/types';
import { insertItems } from './actions';
import { thumbnail } from './thumbnails';
import { CharacterBuilder } from './CharacterBuilder';

export const ASSET_MIME = 'application/x-dra-wings-asset';

type Filter = CategoryId | 'todo' | 'escenas';

/** Inserta un recurso centrado en un punto (o en el centro de la hoja). */
export function insertAsset(asset: LibraryAsset, project: Project, at?: { x: number; y: number }) {
  const { width, height } = project.settings;
  const g = placeGroup(asset.build(), {
    cx: at?.x ?? width / 2,
    cy: at?.y ?? height / 2,
    height: asset.size * height,
  });
  insertItems([g], `Añadir ${asset.name.toLowerCase()}`);
}

export function LibraryPanel({ project }: { project: Project }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [builderOpen, setBuilderOpen] = useState(false);
  const results = useMemo(() => (filter === 'escenas' ? [] : searchLibrary(query, filter)), [query, filter]);

  return (
    <section className="panel library" aria-label="Biblioteca">
      <div className="panel-body">
        <label className="search">
          <Search size={15} aria-hidden />
          <input
            className="search-input"
            type="search"
            placeholder="Buscar: casa, feliz, coche…"
            aria-label="Buscar en la biblioteca"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (filter === 'escenas') setFilter('todo');
            }}
          />
        </label>
        <div className="chips" role="tablist" aria-label="Categorías">
          {[{ id: 'todo' as const, label: 'Todo' }, ...CATEGORIES, { id: 'escenas' as const, label: 'Escenas' }].map(
            (c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={filter === c.id}
                className={`chip ${filter === c.id ? 'is-active' : ''}`}
                onClick={() => setFilter(c.id)}
              >
                {c.label}
              </button>
            ),
          )}
        </div>

        {(filter === 'todo' || filter === 'personajes') && !query && (
          <button className="btn btn-secondary btn-sm" onClick={() => setBuilderOpen(true)}>
            <UserPlus size={16} aria-hidden /> Crear personaje…
          </button>
        )}

        {filter === 'escenas' ? (
          <ul className="template-list">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  className="template"
                  onClick={() =>
                    insertItems(t.build(project.settings.width, project.settings.height), `Escena: ${t.name}`)
                  }
                >
                  <img
                    src={thumbnail(`tpl:${t.id}:${project.settings.width}x${project.settings.height}`, () =>
                      t.build(project.settings.width, project.settings.height),
                    )}
                    alt=""
                  />
                  <span>
                    <span className="choice-title">{t.name}</span>
                    <span className="choice-sub">{t.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : results.length === 0 ? (
          <p className="empty">No hay resultados para «{query}».</p>
        ) : (
          <ul className="asset-grid" aria-label="Recursos">
            {results.map((a) => (
              <li key={a.id}>
                <button
                  className="asset"
                  title={`${a.name} (clic para añadir o arrastra al lienzo)`}
                  aria-label={`Añadir ${a.name}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(ASSET_MIME, a.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => insertAsset(a, project)}
                >
                  <img src={thumbnail(a.id, a.build)} alt="" draggable={false} />
                  <span className="asset-name">{a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CharacterBuilder open={builderOpen} onOpenChange={setBuilderOpen} project={project} />
    </section>
  );
}
