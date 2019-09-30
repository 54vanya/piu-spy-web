import _ from 'lodash/fp';
import localForage from 'localforage';

import { setFilter, resetFilter } from 'reducers/top';

const SELECT_PRESET = `PRESETS/SELECT_PRESET`;
const LOAD_PRESETS = `PRESETS/LOAD_PRESETS`;
const LOADING_START = `PRESETS/LOADING_START`;
const LOADING_END = `PRESETS/LOADING_END`;

const initialState = {
  presets: [],
  currentPreset: null,
  isLoading: false,
};

const itemToOption = item =>
  item && {
    ...item,
    label: item.name,
    value: item.name,
  };

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case LOAD_PRESETS:
      const currentPreset = _.find({ name: _.get('name', state.currentPreset) }, action.presets);
      return {
        ...state,
        currentPreset: itemToOption(currentPreset) || null,
        presets: _.map(itemToOption, action.presets),
      };
    case SELECT_PRESET:
      return {
        ...state,
        currentPreset: itemToOption(action.currentPreset),
      };
    case LOADING_START:
      return {
        ...state,
        isLoading: true,
      };
    case LOADING_END:
      return {
        ...state,
        isLoading: false,
      };
    default:
      return state;
  }
}

const reloadPresets = presets => ({ type: LOAD_PRESETS, presets: presets || [] });

const startLoading = () => ({
  type: LOADING_START,
});

const endLoading = () => ({
  type: LOADING_END,
});

export const selectPreset = currentPreset => ({
  type: SELECT_PRESET,
  currentPreset,
});

export const loadPresets = () => (dispatch, getState) => {
  dispatch(startLoading());
  return localForage.getItem('filterPresets').then(presets => {
    dispatch(reloadPresets(presets));
    dispatch(endLoading());
  });
};

export const savePreset = name => (dispatch, getState) => {
  dispatch(startLoading());
  return localForage.getItem('filterPresets').then(presets => {
    const { filter } = getState().top;
    const newPreset = { name, filter };
    if (!_.some({ name }, presets)) {
      const newPresets = [...(presets || []), newPreset];
      dispatch(reloadPresets(newPresets));
      dispatch(selectPreset(newPreset));
      localForage.setItem('filterPresets', newPresets);
    } else if (window.confirm('Preset with this name already exists, replace it?')) {
      const withoutOldPreset = _.remove({ name }, presets);
      const newPresets = [...withoutOldPreset, newPreset];
      dispatch(reloadPresets(newPresets));
      localForage.setItem('filterPresets', newPresets);
    }
    dispatch(endLoading());
  });
};

export const openPreset = () => (dispatch, getState) => {
  dispatch(startLoading());
  const name = _.get('name', getState().presets.currentPreset);
  return localForage.getItem('filterPresets').then(presets => {
    const preset = name && _.find({ name }, presets);
    if (preset) {
      dispatch(selectPreset(preset));
      dispatch(setFilter(preset.filter));
    } else {
      // Preset not found for some reason, update list
      dispatch(reloadPresets(presets));
    }
    dispatch(endLoading());
  });
};

export const deletePreset = () => (dispatch, getState) => {
  dispatch(startLoading());
  const name = _.get('name', getState().presets.currentPreset);
  return localForage.getItem('filterPresets').then(presets => {
    const preset = _.find({ name }, presets);
    if (preset && window.confirm('Are you sure you want to delete selected preset?')) {
      const withoutOldPreset = _.remove({ name }, presets);
      dispatch(reloadPresets(withoutOldPreset));
      localForage.setItem('filterPresets', withoutOldPreset);
    } else {
      // Preset not found for some reason, update list
      dispatch(reloadPresets(presets));
    }
    dispatch(endLoading());
  });
};
