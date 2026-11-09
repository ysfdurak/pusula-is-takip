// İşe eklenen dosyalar ve fotoğraflar: liste, ekleme, açma/indirme, silme.
import { useRef, useState } from 'react';
import { DownloadIcon, FileTextIcon, ImageIcon, PaperclipIcon, Trash2Icon } from 'lucide-react';

export const ATTACH_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

export function formatBytes(bytes) {
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

export function TaskAttachments({ files, writable, user, isOwner, busy, maxFileBytes, name, timeLabel, onAdd, onOpen, onRemove }) {
  const input = useRef(null);
  const [confirming, setConfirming] = useState('');
  return (
    <section className="attachments" aria-label="Ekler">
      <div className="attachments-head">
        <h3>
          <PaperclipIcon size={14} />
          {' Ekler '}
          {files.length > 0 && <b>{files.length}</b>}
        </h3>
        {writable && (
          <>
            <button className="text-button" type="button" disabled={busy} onClick={() => input.current?.click()}>
              Dosya veya fotoğraf ekle
            </button>
            <input
              ref={input}
              type="file"
              hidden
              multiple
              accept={ATTACH_ACCEPT}
              aria-label="Eklenecek dosyalar"
              onChange={(event) => {
                const list = [...event.target.files];
                event.target.value = '';
                if (list.length) onAdd(list);
              }}
            />
          </>
        )}
      </div>
      {files.length ? (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <button type="button" className="attachment-open" onClick={() => onOpen(file)} title="Aç veya indir">
                {file.type.startsWith('image/') ? <ImageIcon size={15} /> : <FileTextIcon size={15} />}
                <span>
                  <strong>{file.name}</strong>
                  <small>
                    {formatBytes(file.size)} · {name(file.author)} · {timeLabel(file.created)}
                  </small>
                </span>
                <DownloadIcon size={14} />
              </button>
              {writable &&
                (file.author === user || isOwner) &&
                (confirming === file.id ? (
                  <span className="attachment-confirm">
                    <button type="button" className="text-button danger" disabled={busy} onClick={() => onRemove(file)}>
                      Sil
                    </button>
                    <button type="button" className="text-button" onClick={() => setConfirming('')}>
                      Vazgeç
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={file.name + ' dosyasını sil'}
                    disabled={busy}
                    onClick={() => setConfirming(file.id)}
                  >
                    <Trash2Icon size={14} />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="attachments-empty">
          {writable
            ? 'Fotoğraf, PDF veya Office dosyası ekleyebilirsin (en fazla ' + formatBytes(maxFileBytes) + ').'
            : 'Ek yok.'}
        </p>
      )}
    </section>
  );
}
