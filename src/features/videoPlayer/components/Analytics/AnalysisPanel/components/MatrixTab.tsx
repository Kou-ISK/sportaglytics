import React from 'react';
import { MatrixTabView } from './MatrixTabView';
import {
  useMatrixTabController,
  type MatrixTabControllerParams,
} from '../controllers/useMatrixTabController';

export const MatrixTab = (props: MatrixTabControllerParams) => {
  const viewProps = useMatrixTabController(props);
  return <MatrixTabView {...viewProps} />;
};
