// Represents a single navigation item
export interface NavigationItem {
    group?: string; // Group identifier for dividers
    index?: number; // Index for ordering the item
    hidden?: boolean; // Indicates if the item is hidden in the sidebar
    title?: string; // Title of the navigation item
    segment?: string; // Unique identifier for the navigation item
    icon?: React.ReactNode; // Icon for the navigation item
    children?: string[]; // Segment identifiers of nested items
    path?: string; // Optional path for direct navigation
    roles?: string[]; // Roles that can access this item
}

// Represents a group of related navigation items
export interface NavigationGroup {
    index?: number; // Index for ordering the group
    header?: boolean; // Indicates if title is shown as a header
    divider?: boolean; // Indicates if a divider is shown before the group
    title: string; // Title of the group
    segment: string; // Optional segment identifier for the group
}
