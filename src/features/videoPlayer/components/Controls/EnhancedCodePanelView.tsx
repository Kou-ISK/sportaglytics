import React from 'react';
import { Box } from '@mui/material';
import type {
  ActionDefinition,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/settings/coreTypes';
import type { TeamContext } from '../../../../utils/teamPlaceholder';
import { ActionLabelGroup } from './ActionLabelGroup';
import { CodePanelModeIndicator } from './CodePanelModeIndicator';
import { CustomCodeLayout } from './CustomCodeLayout';
import { DefaultCodeLayout } from './DefaultCodeLayout';

export interface EnhancedCodePanelViewProps {
  activeMode: 'code' | 'label';
  customLayout: CodeWindowLayout | null;
  teamContext: TeamContext;
  activeRecordings: Record<string, { startTime: number }>;
  primaryAction: string | null;
  activeLabelButtons: Record<string, boolean>;
  isRecording: boolean;
  layoutContainerRef: React.RefObject<HTMLDivElement | null>;
  teamNames: string[];
  firstTeamName?: string;
  activeActions: ActionDefinition[];
  getActionLabels: (
    action: ActionDefinition,
  ) => { groupName: string; options: string[] }[];
  labelSelections: Record<string, Record<string, string>>;
  handleLabelSelect: (
    actionName: string,
    groupName: string,
    option: string,
  ) => void;
  handleCustomButtonClick: (button: CodeWindowButton) => void;
  handleActionClick: (teamName: string, action: ActionDefinition) => void;
}

export const EnhancedCodePanelView = ({
  activeMode,
  customLayout,
  teamContext,
  activeRecordings,
  primaryAction,
  activeLabelButtons,
  isRecording,
  layoutContainerRef,
  teamNames,
  firstTeamName,
  activeActions,
  getActionLabels,
  labelSelections,
  handleLabelSelect,
  handleCustomButtonClick,
  handleActionClick,
}: EnhancedCodePanelViewProps) => {
  const referenceTeamName = firstTeamName || teamNames[0];

  const renderLabelGroup = (
    actionName: string,
    groupName: string,
    options: string[],
    isLastGroup: boolean,
  ) => {
    const selectionForAction = labelSelections[actionName] ?? {};
    return (
      <ActionLabelGroup
        groupName={groupName}
        options={options}
        selectedOption={selectionForAction[groupName]}
        isLastGroup={isLastGroup}
        onSelect={(option) => handleLabelSelect(actionName, groupName, option)}
      />
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1,
          flexWrap: 'wrap',
        }}
      >
        <CodePanelModeIndicator activeMode={activeMode} />
      </Box>

      {customLayout ? (
        <CustomCodeLayout
          layout={customLayout}
          teamContext={teamContext}
          activeRecordings={activeRecordings}
          primaryAction={primaryAction}
          activeLabelButtons={activeLabelButtons}
          isRecording={isRecording}
          layoutContainerRef={layoutContainerRef}
          onButtonClick={handleCustomButtonClick}
        />
      ) : (
        <DefaultCodeLayout
          teamNames={teamNames}
          referenceTeamName={referenceTeamName}
          actions={activeActions}
          primaryAction={primaryAction}
          activeRecordings={activeRecordings}
          getActionLabels={getActionLabels}
          onActionClick={handleActionClick}
          renderLabelGroup={renderLabelGroup}
        />
      )}
    </Box>
  );
};
