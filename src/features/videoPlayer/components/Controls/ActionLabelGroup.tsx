import React from 'react';
import { Box, Typography } from '@mui/material';
import { EnhancedCodeButton } from './EnhancedCodeButton';

type ActionLabelGroupProps = {
  groupName: string;
  options: string[];
  selectedOption?: string;
  isLastGroup: boolean;
  onSelect: (option: string) => void;
};

export const ActionLabelGroup = ({
  groupName,
  options,
  selectedOption,
  isLastGroup,
  onSelect,
}: ActionLabelGroupProps) => {
  return (
    <Box key={groupName} sx={{ mb: isLastGroup ? 0 : 1 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}
      >
        {groupName}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 0.5,
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          width: '100%',
        }}
      >
        {options.map((option) => (
          <EnhancedCodeButton
            key={option}
            label={option}
            isSelected={selectedOption === option}
            onClick={() => onSelect(option)}
            size="small"
            color="secondary"
          />
        ))}
      </Box>
    </Box>
  );
};
