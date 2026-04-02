import {Text, TextProps} from './Themed';
import {fonts} from '../theme';

export function MonoText(props: TextProps) {
  return <Text {...props} style={[props.style, {fontFamily: fonts.sans}]} />;
}
