"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { UploadCloud } from 'lucide-react';

interface CSVImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function CSVImporter({ isOpen, onClose, onImportComplete }: CSVImporterProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
  
    try {
      for (const file of files) {
        const csvText = await file.text();
        
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: csvText }),
        });
    
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to import contacts.');
        }

        console.log(`Imported ${file.name}:`, await response.json());
      }
      await fetch('/api/contacts/deduplicate', { method: 'POST' });
      onImportComplete();
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsUploading(false);
    }
};

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div style={{background: 'white', borderRadius: '12px', width: '100%', maxWidth: '640px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'}}>
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Import Contacts from CSV</h2>
          <p className="text-sm text-text-secondary mt-1">
            Upload one or more CSV files from Opus. We'll automatically detect the file type.
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center w-full">
              <label
                  htmlFor="dropzone-file"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-border border-dashed rounded-lg cursor-pointer bg-bg hover:bg-gray-100"
              >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">CSV files up to 10MB</p>
                  </div>
                  <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} multiple accept=".csv" />
              </label>
          </div>
          {files.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold">Selected files:</p>
              <ul className="list-disc list-inside">
                {files.map((file, index) => (
                  <li key={index} className="text-sm text-text-secondary">{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end p-6 bg-bg rounded-b-lg">
          <Button variant="outline" onClick={onClose} className="mr-2">Cancel</Button>
          <Button onClick={handleImport} disabled={files.length === 0 || isUploading}>
            {isUploading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}