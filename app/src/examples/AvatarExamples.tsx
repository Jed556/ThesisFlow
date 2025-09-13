// Avatar Component Usage Examples
// This file demonstrates various ways to use the new AvatarComponent

import Avatar, {
    ChipAvatar,
    EmailAvatar,
    NameAvatar,
    ProfileAvatar,
    Name,
    NAME_PRESETS
} from '../components/Avatar';
import { mockUserProfiles } from '../data/mockData';
import { getDisplayName } from '../utils/avatarUtils';

// Example 1: Chip mode
function ThesisTeamExample() {
    const teamMember = mockUserProfiles[0]; // John Doe

    return (
        <Avatar
            profile={teamMember}
            mode="chip"
            label={`${getDisplayName(teamMember)} (Leader)`}
            size="small"
            chipProps={{
                variant: 'outlined',
                size: 'small'
            }}
        />
    );
}

// Example 2: Default avatar
function FileSubmissionExample() {
    return (
        <Avatar
            name="Dr. Jane Smith"
            size="small"
            initials={NAME_PRESETS.firstLast}
        />
    );
}

// Example 3: Email lookup with custom initials
function ParticipantExample() {
    return (
        <Avatar
            email="john.doe@university.edu"
            size="medium"
            initials={NAME_PRESETS.firstLast}
            onClick={() => console.log('Avatar clicked')}
        />
    );
}

// Example 4: Different initial configurations
function InitialsExamples() {
    const profile = mockUserProfiles[2]; // Prof. Michael Johnson

    return (
        <>
            {/* Using preset configurations */}
            <Avatar profile={profile} initials={NAME_PRESETS.firstLast} />
            <Avatar profile={profile} initials={NAME_PRESETS.firstMiddle} />
            <Avatar profile={profile} initials={NAME_PRESETS.lastFirst} />
            <Avatar profile={profile} initials={NAME_PRESETS.all} />
            <Avatar profile={profile} initials={NAME_PRESETS.academic} />

            {/* Custom configurations using enum arrays */}
            <Avatar profile={profile} initials={[Name.PREFIX, Name.LAST]} />
            <Avatar profile={profile} initials={[Name.FIRST, Name.MIDDLE, Name.SUFFIX]} />

            {/* Academic style with prefix */}
            <Avatar profile={profile} initials={NAME_PRESETS.academic} />
        </>
    );
}

// Example 5: Convenience components
function ConvenienceComponentExamples() {
    const profile = mockUserProfiles[1]; // Dr. Jane Smith

    return (
        <>
            {/* Profile-based avatar */}
            <ProfileAvatar profile={profile} size="large" />

            {/* Email-based avatar */}
            <EmailAvatar email="jane.smith@university.edu" size="medium" />

            {/* Name-based avatar */}
            <NameAvatar name="Dr. Jane Smith" size="small" />

            {/* Chip avatar with default settings */}
            <ChipAvatar
                profile={profile}
                label="Dr. Jane Smith (Adviser)"
                chipProps={{ color: 'primary' }}
            />
        </>
    );
}

// Example 6: Custom styling
function CustomStyledExample() {
    return (
        <Avatar
            name="Custom User"
            size={48} // Custom numeric size
            sx={{
                bgcolor: 'secondary.main',
                color: 'secondary.contrastText',
                fontWeight: 'bold'
            }}
        />
    );
}

// Example 7: Advanced enum-based configurations
function AdvancedInitialsExamples() {
    const profile = mockUserProfiles[1]; // Dr. Jane Smith

    return (
        <>
            {/* Custom combinations */}
            <Avatar
                profile={profile}
                initials={[Name.PREFIX, Name.FIRST]} // "DJ" (Dr. Jane)
                mode="chip"
                label="Prefix + First"
            />

            <Avatar
                profile={profile}
                initials={[Name.LAST, Name.SUFFIX]} // "S" (Smith + suffix if any)
                mode="chip"
                label="Last + Suffix"
            />

            {/* Auto mode for smart defaults */}
            <Avatar
                profile={profile}
                initials="auto" // Automatically chooses first + last
                mode="chip"
                label="Auto Mode"
            />

            {/* Only middle name if available */}
            <Avatar
                profile={profile}
                initials={[Name.MIDDLE]} // Empty if no middle name
                mode="chip"
                label="Middle Only"
            />
        </>
    );
}

export {
    ThesisTeamExample,
    FileSubmissionExample,
    ParticipantExample,
    InitialsExamples,
    ConvenienceComponentExamples,
    CustomStyledExample,
    AdvancedInitialsExamples
};