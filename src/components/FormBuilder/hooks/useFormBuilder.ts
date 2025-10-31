import * as React from 'react';
import type { FormField, FormFieldType, FormTemplate } from '../../../types/forms';

/**
 * Generate a reasonably unique identifier for template artefacts.
 */
function generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a skeleton field with sensible defaults for the requested type.
 */
export function createEmptyField(fieldType: FormFieldType): FormField {
    const base: FormField = {
        id: generateId('field'),
        fieldType,
        label: 'Untitled field',
        required: false,
    };

    switch (fieldType) {
        case 'shortText':
            return {
                ...base,
                placeholder: 'Enter a short response',
                maxLength: 200,
            };
        case 'longText':
            return {
                ...base,
                placeholder: 'Provide a detailed response',
                rows: 5,
            };
        case 'select':
        case 'multiSelect':
            return {
                ...base,
                fieldType,
                allowMultiple: fieldType === 'multiSelect',
                options: [
                    { id: generateId('option'), label: 'Option A', value: 'option-a' },
                    { id: generateId('option'), label: 'Option B', value: 'option-b' },
                ],
            };
        case 'date':
            return {
                ...base,
                helperText: 'Pick a calendar date',
            };
        case 'file':
            return {
                ...base,
                helperText: 'Upload supporting documents',
            };
        case 'checkbox':
            return {
                ...base,
                label: 'I acknowledge the requirement',
            };
        case 'signature':
            return {
                ...base,
                helperText: 'Sign with your registered name',
            };
        default:
            return base;
    }
}

/**
 * Normalise an incoming template so state mutations do not leak to callers.
 */
function normaliseTemplate(template?: FormTemplate): FormTemplate {
    const base: FormTemplate = template
        ? { ...template, fields: template.fields.map((field) => ({ ...field })) }
        : {
            id: generateId('template'),
            title: 'Untitled template',
            description: '',
            version: '1.0.0',
            audience: 'student',
            fields: [],
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system@thesisflow.local',
        };

    return base;
}

/**
 * Return type for the form builder hook.
 */
export interface UseFormBuilderResult {
    /** Current working template state. */
    template: FormTemplate;
    /** Identifier of the field currently being edited. */
    activeFieldId: string | null;
    /** Update the metadata of the template (title, description, etc.). */
    updateTemplateMeta: (updates: Partial<FormTemplate>) => void;
    /** Append a new field of the specified type to the template. */
    addField: (fieldType: FormFieldType) => FormField;
    /** Update field properties by id. */
    updateField: (fieldId: string, updates: Partial<FormField>) => void;
    /** Remove a field from the template by id. */
    removeField: (fieldId: string) => void;
    /** Move a field to a new index within the template. */
    moveField: (fieldId: string, direction: -1 | 1) => void;
    /** Explicitly set which field is active in the editor pane. */
    setActiveFieldId: (fieldId: string | null) => void;
    /** Reset the template back to the initial seed. */
    reset: () => void;
}

/**
 * Manage the lifecycle of a dynamic form template while editing.
 */
export function useFormBuilder(initialTemplate?: FormTemplate): UseFormBuilderResult {
    const seedRef = React.useRef<FormTemplate>(normaliseTemplate(initialTemplate));

    const [template, setTemplate] = React.useState<FormTemplate>(() => normaliseTemplate(seedRef.current));
    const [activeFieldId, setActiveFieldId] = React.useState<string | null>(() => template.fields[0]?.id ?? null);

    /**
     * Update template level metadata such as title, description, or audience.
     */
    const updateTemplateMeta = React.useCallback((updates: Partial<FormTemplate>) => {
        setTemplate((prev) => ({
            ...prev,
            ...updates,
            updatedAt: new Date().toISOString(),
        }));
    }, []);

    /**
     * Add a new field to the template and mark it as the active field.
     */
    const addField = React.useCallback((fieldType: FormFieldType): FormField => {
        const field = createEmptyField(fieldType);
        setTemplate((prev) => ({
            ...prev,
            fields: [...prev.fields, field],
            updatedAt: new Date().toISOString(),
        }));
        setActiveFieldId(field.id);
        return field;
    }, []);

    /**
     * Update a field by merging the supplied partial payload.
     */
    const updateField = React.useCallback((fieldId: string, updates: Partial<FormField>) => {
        setTemplate((prev) => ({
            ...prev,
            fields: prev.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field),
            updatedAt: new Date().toISOString(),
        }));
    }, []);

    /**
     * Remove a field from the template, updating the active field id to a sensible fallback.
     */
    const removeField = React.useCallback((fieldId: string) => {
        setTemplate((prev) => {
            const nextFields = prev.fields.filter((field) => field.id !== fieldId);
            setActiveFieldId((current) => {
                if (current !== fieldId) return current;
                return nextFields[0]?.id ?? null;
            });
            return {
                ...prev,
                fields: nextFields,
                updatedAt: new Date().toISOString(),
            };
        });
    }, []);

    /**
     * Move a field up or down within the template.
     */
    const moveField = React.useCallback((fieldId: string, direction: -1 | 1) => {
        setTemplate((prev) => {
            const index = prev.fields.findIndex((field) => field.id === fieldId);
            if (index === -1) return prev;

            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= prev.fields.length) {
                return prev;
            }

            const nextFields = [...prev.fields];
            const [removed] = nextFields.splice(index, 1);
            nextFields.splice(targetIndex, 0, removed);

            return {
                ...prev,
                fields: nextFields,
                updatedAt: new Date().toISOString(),
            };
        });
    }, []);

    /**
     * Reset the builder back to the initial seed template.
     */
    const reset = React.useCallback(() => {
        const initial = normaliseTemplate(seedRef.current);
        seedRef.current = initial;
        setTemplate(initial);
        setActiveFieldId(initial.fields[0]?.id ?? null);
    }, []);

    return {
        template,
        activeFieldId,
        updateTemplateMeta,
        addField,
        updateField,
        removeField,
        moveField,
        setActiveFieldId,
        reset,
    };
}
