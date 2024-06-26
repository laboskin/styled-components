import {
  Attrs,
  BaseObject,
  Interpolation,
  IStyledComponent,
  IStyledComponentFactory,
  KnownTarget,
  NoInfer,
  Runtime,
  StyledOptions,
  StyledTarget,
  Styles,
  Substitute,
} from '../types';
import { EMPTY_OBJECT } from '../utils/empties';
import styledError from '../utils/error';
import css from './css';

type AttrsResult<T extends Attrs<any>> = T extends (...args: any) => infer P
  ? P extends object
    ? P
    : never
  : T extends object
    ? T
    : never;

/**
 * Extract non-optional fields from given object type.
 */
type RequiredFields<T, Ex> = Pick<
  T,
  {
    [K in keyof T]-?: undefined extends T[K] ? never : K;
  }[Exclude<keyof T, Ex>]
>;

export interface Styled<
  R extends Runtime,
  Target extends StyledTarget<R>,
  OuterProps extends object,
  OuterStatics extends object = BaseObject,
  InnerProps extends object = OuterProps,
> {
  <Props extends object = BaseObject, Statics extends object = BaseObject>(
    initialStyles: Styles<Substitute<InnerProps, NoInfer<Props>>>,
    ...interpolations: Interpolation<Substitute<InnerProps, NoInfer<Props>>>[]
  ): IStyledComponent<R, Substitute<OuterProps, Props>> &
    OuterStatics &
    Statics &
    (R extends 'web'
      ? Target extends string
        ? {}
        : Omit<Target, keyof React.Component<any>>
      : {});

  attrs: <
    Props extends object = BaseObject,
    PrivateMergedProps extends object = Substitute<OuterProps, Props>,
    PrivateAttrsArg extends Attrs<PrivateMergedProps> = Attrs<PrivateMergedProps>,
  >(
    attrs: PrivateAttrsArg
  ) => StyledAttrsResult<
    R,
    Target,
    OuterProps,
    OuterStatics,
    InnerProps,
    Props,
    PrivateMergedProps,
    PrivateAttrsArg
  >;

  withConfig: (config: StyledOptions<R, OuterProps>) => Styled<R, Target, OuterProps, OuterStatics>;
}

type StyledAttrsResult<
  R extends Runtime,
  Target extends StyledTarget<R>,
  OuterProps extends object,
  OuterStatics extends object = BaseObject,
  InnerProps extends object = OuterProps,
  Props extends object = BaseObject,
  PrivateMergedProps extends object = Substitute<OuterProps, Props>,
  PrivateAttrsArg extends Attrs<PrivateMergedProps> = Attrs<PrivateMergedProps>,
> = (
  AttrsResult<PrivateAttrsArg> extends { as: infer RuntimeTarget extends KnownTarget }
    ? {
        Target: RuntimeTarget;
        TargetProps: Substitute<OuterProps, React.ComponentPropsWithRef<RuntimeTarget>>;
      }
    : { Target: Target; TargetProps: OuterProps }
) extends {
  Target: infer PrivateResolvedTarget extends StyledTarget<R>;
  TargetProps: infer TargetProps extends object;
}
  ? Styled<
      R,
      PrivateResolvedTarget,
      PrivateResolvedTarget extends KnownTarget
        ? Substitute<TargetProps, Props & Partial<RequiredFields<PrivateAttrsArg, 'as'>>>
        : PrivateMergedProps,
      OuterStatics,
      PrivateResolvedTarget extends KnownTarget
        ? Substitute<
            Substitute<InnerProps, React.ComponentPropsWithRef<PrivateResolvedTarget>>,
            Props
          >
        : PrivateMergedProps
    >
  : unknown;

export default function constructWithOptions<
  R extends Runtime,
  Target extends StyledTarget<R>,
  OuterProps extends object = Target extends KnownTarget
    ? React.ComponentPropsWithRef<Target>
    : BaseObject,
  OuterStatics extends object = BaseObject,
  InnerProps extends object = OuterProps,
>(
  componentConstructor: IStyledComponentFactory<R, StyledTarget<R>, object, any>,
  tag: StyledTarget<R>,
  options: StyledOptions<R, OuterProps> = EMPTY_OBJECT
): Styled<R, Target, OuterProps, OuterStatics, InnerProps> {
  /**
   * We trust that the tag is a valid component as long as it isn't
   * falsish. Typically the tag here is a string or function (i.e.
   * class or pure function component), however a component may also be
   * an object if it uses another utility, e.g. React.memo. React will
   * output an appropriate warning however if the `tag` isn't valid.
   */
  if (!tag) {
    throw styledError(1, tag);
  }

  /* This is callable directly as a template function */
  const templateFunction = <Props extends object = BaseObject, Statics extends object = BaseObject>(
    initialStyles: Styles<Substitute<InnerProps, Props>>,
    ...interpolations: Interpolation<Substitute<InnerProps, Props>>[]
  ) =>
    componentConstructor<Substitute<InnerProps, Props>, Statics>(
      tag,
      options as StyledOptions<R, Substitute<InnerProps, Props>>,
      css<Substitute<InnerProps, Props>>(initialStyles, ...interpolations)
    );

  /**
   * Attrs allows for accomplishing two goals:
   *
   * 1. Backfilling props at runtime more expressively than defaultProps
   * 2. Amending the prop interface of a wrapped styled component
   */
  templateFunction.attrs = <
    Props extends object = BaseObject,
    PrivateMergedProps extends object = Substitute<OuterProps, Props>,
    PrivateAttrsArg extends Attrs<PrivateMergedProps> = Attrs<PrivateMergedProps>,
  >(
    attrs: PrivateAttrsArg
  ): StyledAttrsResult<
    R,
    Target,
    OuterProps,
    OuterStatics,
    InnerProps,
    Props,
    PrivateMergedProps,
    PrivateAttrsArg
  > =>
    constructWithOptions<R, Target, any, any, any>(componentConstructor, tag, {
      ...options,
      attrs: Array.prototype.concat(options.attrs, attrs).filter(Boolean),
    }) as any;

  /**
   * If config methods are called, wrap up a new template function
   * and merge options.
   */
  templateFunction.withConfig = (config: StyledOptions<R, OuterProps>) =>
    constructWithOptions<R, Target, OuterProps, OuterStatics>(componentConstructor, tag, {
      ...options,
      ...config,
    });

  return templateFunction;
}
