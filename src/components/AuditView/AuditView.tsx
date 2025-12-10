import * as React from 'react';
import {
    Alert, Box, Card, CardContent, Chip, IconButton, Stack, Tooltip, Typography
} from '@mui/material';
import { Refresh as RefreshIcon, Clear as ClearIcon } from '@mui/icons-material';
import { isValid } from 'date-fns';
import type {
    AnyAuditEntry, AuditCategory, AuditQueryOptions, UserAuditQueryOptions
} from '../../types/audit';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import {
    listenAllGroups, getGroupsByMember, getGroupsByDepartment, getGroupsByCourse, getAllGroupsByPanelMember
} from '../../utils/firebase/firestore/groups';
import { findUsersByIds, onUserProfile } from '../../utils/firebase/firestore/user';
import {
    listenAuditEntries, listenAllAuditEntries, listenAllUserAuditEntries, buildAuditContext
} from '../../utils/auditUtils';
import { AuditFilters } from './AuditFilters';
import { AuditList } from './AuditList';
import {
    type AuditScope, type AuditViewProps, getAvailableScopes, DEFAULT_FILTER_CONFIG, DEFAULT_DISPLAY_CONFIG
} from './types';

/**
 * Group courses by department for hierarchical display
 */
type DepartmentCourseMap = Record<string, string[]>;

/**
 * AuditView component for displaying audit history with role-based filtering
 *
 * @example
 * // Basic usage with auto-detected role scopes
 * <AuditView userRole={session?.user?.role} userUid={session?.user?.uid} />
 *
 * @example
 * // Fixed to group scope for a specific group
 * <AuditView
 *   userRole={userRole}
 *   userUid={userUid}
 *   scopeConfig={{ availableScopes: ['group'], defaultScope: 'group' }}
 *   dataConfig={{ groupId: 'group-123' }}
 * />
 *
 * @example
 * // Embedded in another component without card wrapper
 * <AuditView
 *   userRole={userRole}
 *   userUid={userUid}
 *   embedded
 *   displayConfig={{ compact: true, itemsPerPage: 10 }}
 * />
 */
export function AuditView({
    userRole,
    userUid,
    scopeConfig,
    filterConfig,
    displayConfig,
    dataConfig,
    callbacks,
    headerActions,
    embedded = false,
}: AuditViewProps): React.ReactElement {
    // Merge configs with defaults
    const mergedFilterConfig = { ...DEFAULT_FILTER_CONFIG, ...filterConfig };
    const mergedDisplayConfig = { ...DEFAULT_DISPLAY_CONFIG, ...displayConfig };

    // Available scopes based on role or config
    const availableScopes = React.useMemo(
        () => scopeConfig?.availableScopes ?? getAvailableScopes(userRole),
        [scopeConfig?.availableScopes, userRole]
    );

    // User profile for department/course info
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

    // Scope and filter state
    const [selectedScope, setSelectedScope] = React.useState<AuditScope>(
        scopeConfig?.defaultScope ?? availableScopes[0] ?? 'personal'
    );
    const [allGroups, setAllGroups] = React.useState<ThesisGroup[]>([]);
    const [userGroups, setUserGroups] = React.useState<ThesisGroup[]>([]);
    const [departmentGroups, setDepartmentGroups] = React.useState<ThesisGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>(
        dataConfig?.groupId ?? ''
    );
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = React.useState<string>(
        dataConfig?.department ?? ''
    );
    const [courses, setCourses] = React.useState<string[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState<string>(
        dataConfig?.course ?? ''
    );
    const [departmentCourseMap, setDepartmentCourseMap] = React.useState<DepartmentCourseMap>({});

    // Audit state
    const [audits, setAudits] = React.useState<AnyAuditEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [groupsLoading, setGroupsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [userProfiles, setUserProfiles] = React.useState<Map<string, UserProfile>>(new Map());

    // Filter state
    const [categoryFilter, setCategoryFilter] = React.useState<AuditCategory | ''>(
        mergedFilterConfig.defaultCategory ?? ''
    );
    const [startDate, setStartDate] = React.useState<Date | null>(null);
    const [endDate, setEndDate] = React.useState<Date | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');

    // Pagination
    const [page, setPage] = React.useState(1);

    // Load user profile
    React.useEffect(() => {
        if (!userUid) {
            setUserProfile(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(userUid, (profile) => {
            setUserProfile(profile);
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    // Load all groups (for admin scope)
    React.useEffect(() => {
        if (!availableScopes.includes('admin')) {
            return () => { /* no-op */ };
        }

        setGroupsLoading(true);
        const unsubscribe = listenAllGroups({
            onData: (groupData) => {
                setAllGroups(groupData);
                setGroupsLoading(false);

                // Build department-course map
                const deptCourseMap: DepartmentCourseMap = {};
                const depts = new Set<string>();
                groupData.forEach((group) => {
                    if (group.department) {
                        depts.add(group.department);
                        if (!deptCourseMap[group.department]) {
                            deptCourseMap[group.department] = [];
                        }
                        if (
                            group.course &&
                            !deptCourseMap[group.department].includes(group.course)
                        ) {
                            deptCourseMap[group.department].push(group.course);
                        }
                    }
                });
                setDepartments(Array.from(depts).sort());
                setDepartmentCourseMap(deptCourseMap);
            },
            onError: (err) => {
                console.error('Failed to load all groups:', err);
                setGroupsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [availableScopes]);

    // Load user's groups (for personal/group scope)
    // Also loads groups where user is a panel member
    React.useEffect(() => {
        if (!userUid) {
            setUserGroups([]);
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);

        void (async () => {
            try {
                // Fetch both member groups and panel groups
                const [memberGroups, panelGroups] = await Promise.all([
                    getGroupsByMember(userUid),
                    getAllGroupsByPanelMember(userUid),
                ]);
                if (cancelled) return;

                // Merge and deduplicate groups
                const groupMap = new Map<string, ThesisGroup>();
                memberGroups.forEach((g: ThesisGroup) => groupMap.set(g.id, g));
                panelGroups.forEach((g: ThesisGroup) => groupMap.set(g.id, g));
                const allUserGroups = Array.from(groupMap.values());

                setUserGroups(allUserGroups);
                setGroupsLoading(false);

                // Auto-select first group for group scope if not pre-configured
                if (
                    !dataConfig?.groupId &&
                    (selectedScope === 'group' || selectedScope === 'personal') &&
                    allUserGroups.length > 0 &&
                    !selectedGroupId
                ) {
                    setSelectedGroupId(allUserGroups[0].id);
                }

                // Fall back to personal scope if no groups and currently on group scope
                if (allUserGroups.length === 0 && selectedScope === 'group') {
                    setSelectedScope('personal');
                }
            } catch (err) {
                console.error('Failed to load user groups:', err);
                if (!cancelled) setGroupsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userUid, dataConfig?.groupId]);

    // Load department groups (for departmental scope)
    React.useEffect(() => {
        if (selectedScope !== 'departmental' || !selectedDepartment) {
            setDepartmentGroups([]);
            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                let groups: ThesisGroup[];
                if (selectedCourse) {
                    groups = await getGroupsByCourse(selectedCourse);
                    groups = groups.filter((g) => g.department === selectedDepartment);
                } else {
                    groups = await getGroupsByDepartment(selectedDepartment);
                }
                if (cancelled) return;
                setDepartmentGroups(groups);
            } catch (err) {
                console.error('Failed to load department groups:', err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [selectedScope, selectedDepartment, selectedCourse]);

    // Update courses when department changes
    React.useEffect(() => {
        if (selectedDepartment && departmentCourseMap[selectedDepartment]) {
            setCourses(departmentCourseMap[selectedDepartment].sort());
        } else {
            setCourses([]);
        }
        if (!dataConfig?.course) {
            setSelectedCourse('');
        }
    }, [selectedDepartment, departmentCourseMap, dataConfig?.course]);

    // Get groups to display based on scope
    const displayGroups = React.useMemo(() => {
        // If groups are pre-configured, use them
        if (dataConfig?.groups) {
            return dataConfig.groups;
        }

        switch (selectedScope) {
            case 'personal':
            case 'group':
                return userGroups;
            case 'departmental':
                return departmentGroups;
            case 'admin':
                if (selectedDepartment) {
                    let filtered = allGroups.filter((g) => g.department === selectedDepartment);
                    if (selectedCourse) {
                        filtered = filtered.filter((g) => g.course === selectedCourse);
                    }
                    return filtered;
                }
                return allGroups;
            default:
                return [];
        }
    }, [
        selectedScope, userGroups, departmentGroups, allGroups,
        selectedDepartment, selectedCourse, dataConfig?.groups
    ]);

    // Get selected group data
    const selectedGroup = React.useMemo(
        () => displayGroups.find((g) => g.id === selectedGroupId),
        [displayGroups, selectedGroupId]
    );

    // Effective user ID filter (from config or based on scope)
    const effectiveUserId = React.useMemo(() => {
        if (dataConfig?.userId) return dataConfig.userId;
        if (selectedScope === 'personal') return userUid ?? undefined;
        return undefined;
    }, [dataConfig?.userId, selectedScope, userUid]);

    // Load audits based on scope and selection
    React.useEffect(() => {
        // Personal scope: Query user audits (users/{userId}/audits)
        if (selectedScope === 'personal') {
            if (!userUid) {
                setAudits([]);
                setLoading(false);
                return () => { /* no-op */ };
            }

            setLoading(true);
            setError(null);

            const queryOptions: UserAuditQueryOptions = {
                orderDirection: 'desc',
            };

            if (categoryFilter) queryOptions.category = categoryFilter;
            if (startDate && isValid(startDate)) {
                queryOptions.startDate = startDate.toISOString();
            }
            if (endDate && isValid(endDate)) {
                queryOptions.endDate = endDate.toISOString();
            }

            const unsubscribe = listenAllUserAuditEntries(
                userUid,
                {
                    onData: (userAuditData) => {
                        // UserAuditEntry is compatible with AnyAuditEntry
                        setAudits(userAuditData);
                        setLoading(false);
                    },
                    onError: (err) => {
                        console.error('Failed to load user audits:', err);
                        setError('Unable to load personal audit history. Please try again later.');
                        setLoading(false);
                    },
                },
                queryOptions
            );

            return () => {
                unsubscribe();
            };
        }

        // Group scope: Query group audits (groups/{groupId}/audits)
        if (selectedScope === 'group') {
            if (!selectedGroup) {
                setAudits([]);
                setLoading(false);
                return () => { /* no-op */ };
            }

            setLoading(true);
            setError(null);

            const ctx = buildAuditContext(
                selectedGroup.id,
                selectedGroup.department || 'general',
                selectedGroup.course || 'common',
                selectedGroup.year
            );

            const queryOptions: AuditQueryOptions = {
                orderDirection: 'desc',
            };

            if (effectiveUserId) queryOptions.userId = effectiveUserId;
            if (categoryFilter) queryOptions.category = categoryFilter;
            if (startDate && isValid(startDate)) {
                queryOptions.startDate = startDate.toISOString();
            }
            if (endDate && isValid(endDate)) {
                queryOptions.endDate = endDate.toISOString();
            }

            const unsubscribe = listenAuditEntries(
                ctx,
                {
                    onData: (auditData) => {
                        setAudits(auditData);
                        setLoading(false);
                    },
                    onError: (err) => {
                        console.error('Failed to load audits:', err);
                        setError('Unable to load audit history. Please try again later.');
                        setLoading(false);
                    },
                },
                queryOptions
            );

            return () => {
                unsubscribe();
            };
        }

        if (selectedScope === 'departmental' || selectedScope === 'admin') {
            if (selectedGroup) {
                setLoading(true);
                setError(null);

                const ctx = buildAuditContext(
                    selectedGroup.id,
                    selectedGroup.department || 'general',
                    selectedGroup.course || 'common',
                    selectedGroup.year
                );

                const queryOptions: AuditQueryOptions = {
                    orderDirection: 'desc',
                };

                if (categoryFilter) queryOptions.category = categoryFilter;
                if (startDate && isValid(startDate)) {
                    queryOptions.startDate = startDate.toISOString();
                }
                if (endDate && isValid(endDate)) {
                    queryOptions.endDate = endDate.toISOString();
                }

                const unsubscribe = listenAuditEntries(
                    ctx,
                    {
                        onData: (auditData) => {
                            setAudits(auditData);
                            setLoading(false);
                        },
                        onError: (err) => {
                            console.error('Failed to load audits:', err);
                            setError('Unable to load audit history. Please try again later.');
                            setLoading(false);
                        },
                    },
                    queryOptions
                );

                return () => {
                    unsubscribe();
                };
            } else {
                setLoading(true);
                setError(null);

                const queryOptions: AuditQueryOptions = {
                    orderDirection: 'desc',
                };

                if (categoryFilter) queryOptions.category = categoryFilter;
                if (startDate && isValid(startDate)) {
                    queryOptions.startDate = startDate.toISOString();
                }
                if (endDate && isValid(endDate)) {
                    queryOptions.endDate = endDate.toISOString();
                }

                const unsubscribe = listenAllAuditEntries(
                    {
                        onData: (auditData) => {
                            let filtered = auditData;
                            if (selectedDepartment || selectedCourse) {
                                const targetGroupIds = new Set(displayGroups.map((g) => g.id));
                                filtered = auditData.filter((a) => targetGroupIds.has(a.groupId));
                            }
                            setAudits(filtered);
                            setLoading(false);
                        },
                        onError: (err) => {
                            console.error('Failed to load audits:', err);
                            setError('Unable to load audit history. Please try again later.');
                            setLoading(false);
                        },
                    },
                    queryOptions
                );

                return () => {
                    unsubscribe();
                };
            }
        }

        return () => { /* no-op */ };
    }, [
        selectedScope, selectedGroup, effectiveUserId, categoryFilter, startDate, endDate,
        displayGroups, selectedDepartment, selectedCourse
    ]);

    // Load user profiles for audit entries
    React.useEffect(() => {
        if (audits.length === 0) {
            setUserProfiles(new Map());
            return;
        }

        const userIds = [...new Set(audits.map((a) => a.userId))];

        let cancelled = false;
        void (async () => {
            try {
                const profiles = await findUsersByIds(userIds);
                if (cancelled) return;
                const profileMap = new Map<string, UserProfile>();
                profiles.forEach((profile) => {
                    profileMap.set(profile.uid, profile);
                });
                setUserProfiles(profileMap);
            } catch (err) {
                console.error('Failed to load user profiles:', err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [audits]);

    // Filter audits by search term
    const filteredAudits = React.useMemo(() => {
        if (!searchTerm.trim()) return audits;
        const term = searchTerm.toLowerCase();
        return audits.filter(
            (audit) =>
                audit.name.toLowerCase().includes(term) ||
                audit.description.toLowerCase().includes(term)
        );
    }, [audits, searchTerm]);

    // Reset page when filters change
    React.useEffect(() => {
        setPage(1);
    }, [selectedScope, selectedGroupId, categoryFilter, startDate, endDate, searchTerm]);

    // Reset selection when scope changes (unless fixed by config)
    React.useEffect(() => {
        if (!dataConfig?.groupId) setSelectedGroupId('');
        if (!dataConfig?.department) setSelectedDepartment('');
        if (!dataConfig?.course) setSelectedCourse('');
    }, [selectedScope, dataConfig?.groupId, dataConfig?.department, dataConfig?.course]);

    // Auto-select user's department for moderator/head
    React.useEffect(() => {
        if (
            !dataConfig?.department &&
            selectedScope === 'departmental' &&
            userProfile?.department &&
            !selectedDepartment
        ) {
            setSelectedDepartment(userProfile.department);
        }
    }, [selectedScope, userProfile, selectedDepartment, dataConfig?.department]);

    // Callbacks
    const handleScopeChange = React.useCallback(
        (scope: AuditScope) => {
            setSelectedScope(scope);
            callbacks?.onScopeChange?.(scope);
        },
        [callbacks]
    );

    const handleGroupChange = React.useCallback(
        (groupId: string) => {
            setSelectedGroupId(groupId);
            callbacks?.onGroupChange?.(groupId || null);
        },
        [callbacks]
    );

    const handleClearFilters = React.useCallback(() => {
        setCategoryFilter('');
        setStartDate(null);
        setEndDate(null);
        setSearchTerm('');
    }, []);

    const handleRefresh = React.useCallback(() => {
        callbacks?.onRefresh?.();
    }, [callbacks]);

    const hasActiveFilters = Boolean(categoryFilter || startDate || endDate || searchTerm);

    // Get title for the audit list
    const listTitle = React.useMemo(() => {
        if (selectedGroup) return selectedGroup.name;
        if (selectedScope === 'admin' || selectedScope === 'departmental') {
            if (selectedDepartment) {
                return selectedCourse
                    ? `${selectedDepartment} - ${selectedCourse}`
                    : selectedDepartment;
            }
            return 'All Audits';
        }
        return mergedDisplayConfig.title;
    }, [selectedGroup, selectedScope, selectedDepartment, selectedCourse, mergedDisplayConfig.title]);

    // All groups for name lookup
    const allGroupsForLookup = React.useMemo(
        () => [...allGroups, ...userGroups, ...departmentGroups],
        [allGroups, userGroups, departmentGroups]
    );

    // Determine if we should show group name
    const showGroupNameInList = mergedDisplayConfig.showGroupName && !selectedGroup;

    // Content wrapper
    const ContentWrapper = embedded ? React.Fragment : Card;
    const contentWrapperProps = embedded ? {} : {};

    return (
        <Box>
            {/* Header */}
            {!embedded && (
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={2}
                    sx={{ mb: 2 }}
                >
                    <Typography variant="h6">{mergedDisplayConfig.title}</Typography>
                    <Stack direction="row" spacing={1}>
                        {headerActions}
                        {hasActiveFilters && (
                            <Tooltip title="Clear all filters">
                                <IconButton onClick={handleClearFilters} size="small">
                                    <ClearIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Refresh">
                            <IconButton onClick={handleRefresh} size="small">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            )}

            {/* Filters */}
            <Box sx={{ mb: embedded ? 2 : 3 }}>
                <AuditFilters
                    scope={selectedScope}
                    availableScopes={availableScopes}
                    onScopeChange={handleScopeChange}
                    showScopeSelector={scopeConfig?.showScopeSelector !== false}
                    selectedDepartment={selectedDepartment}
                    departments={departments}
                    onDepartmentChange={setSelectedDepartment}
                    selectedCourse={selectedCourse}
                    courses={courses}
                    onCourseChange={setSelectedCourse}
                    selectedGroupId={selectedGroupId}
                    groups={displayGroups}
                    groupsLoading={groupsLoading}
                    onGroupChange={handleGroupChange}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    startDate={startDate}
                    onStartDateChange={setStartDate}
                    endDate={endDate}
                    onEndDateChange={setEndDate}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    config={{
                        ...mergedFilterConfig,
                        // Hide group selector for personal scope (user audits don't belong to groups)
                        showGroupSelector: selectedScope !== 'personal' && mergedFilterConfig.showGroupSelector,
                    }}
                />
            </Box>

            {/* Alerts */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {selectedScope === 'group' &&
                !selectedGroupId &&
                !groupsLoading &&
                !dataConfig?.groupId && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Please select a group to view its audit history.
                    </Alert>
                )}

            {userGroups.length === 0 &&
                !groupsLoading &&
                selectedScope === 'group' &&
                !dataConfig?.groups && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        You are not a member of any groups yet.
                    </Alert>
                )}

            {/* Content */}
            <ContentWrapper {...contentWrapperProps}>
                {embedded ? (
                    <Box>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="subtitle1" fontWeight="medium">
                                {listTitle}
                            </Typography>
                            <Chip
                                label={`${filteredAudits.length} entries`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        </Stack>
                        <AuditList
                            audits={filteredAudits}
                            loading={loading}
                            userProfiles={userProfiles}
                            groups={allGroupsForLookup}
                            showGroupName={showGroupNameInList}
                            showAvatars={mergedDisplayConfig.showAvatars}
                            itemsPerPage={mergedDisplayConfig.itemsPerPage}
                            page={page}
                            onPageChange={setPage}
                            emptyMessage={mergedDisplayConfig.emptyMessage}
                            hasActiveFilters={hasActiveFilters}
                            compact={mergedDisplayConfig.compact}
                        />
                    </Box>
                ) : (
                    <CardContent>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mb: 2 }}
                        >
                            <Typography variant="h6">{listTitle}</Typography>
                            <Chip
                                label={`${filteredAudits.length} entries`}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        </Stack>
                        <AuditList
                            audits={filteredAudits}
                            loading={loading}
                            userProfiles={userProfiles}
                            groups={allGroupsForLookup}
                            showGroupName={showGroupNameInList}
                            showAvatars={mergedDisplayConfig.showAvatars}
                            itemsPerPage={mergedDisplayConfig.itemsPerPage}
                            page={page}
                            onPageChange={setPage}
                            emptyMessage={mergedDisplayConfig.emptyMessage}
                            hasActiveFilters={hasActiveFilters}
                            compact={mergedDisplayConfig.compact}
                        />
                    </CardContent>
                )}
            </ContentWrapper>
        </Box>
    );
}

export default AuditView;
