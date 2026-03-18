import React from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';
import { useCustomChartTabController } from '../controllers/useCustomChartTabController';
import { CustomChartTabView } from './CustomChartTabView';

interface CustomChartTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
}

export const CustomChartTab: React.FC<CustomChartTabProps> = (props) => {
  const viewProps = useCustomChartTabController(props);
  return <CustomChartTabView {...viewProps} />;
};
