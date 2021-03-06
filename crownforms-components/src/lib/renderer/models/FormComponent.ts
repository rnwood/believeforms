import { computed, observable } from "mobx";
import {
  FormModel,
  SectionModel,
  FormComponentConstructor,
  TypedValue,
  FieldModel,
  IFieldModelOptions,
  ITaskModel,
} from ".";
import { nanoid } from "nanoid";

export interface IOptions {
  [x: string]: string|number|boolean|Date|IOptions|JsonableArray|null|undefined;
}
interface JsonableArray extends Array<null|string|number|boolean|Date|IOptions|JsonableArray> { }

export interface IFormComponentOptions extends IOptions {
  type: string;
  name: string;
}

export interface IFormComponentState
  extends IOptions {
  key: string;
  id: string;
}

export abstract class FormComponent<
  TOptions extends IFormComponentOptions = IFormComponentOptions,
  TState extends IFormComponentState = IFormComponentState
> {
  constructor(
    parent:
      | FormComponent<IFormComponentOptions, IFormComponentState>
      | undefined,
    options: TOptions,
    state?: TState | undefined
  ) {
    this.parent = parent;
    this.options = options;
    this.id = state?.id ?? ("c_" + nanoid());
  }

  readonly id: string;

  @observable readonly options: TOptions;

  abstract getState() :TState;

  static async initWithChildrenAsync(
    component: FormComponent<IFormComponentOptions, IFormComponentState>,
    isTopLevelBeingInited: boolean = true
  ) {
    await component.initComponentAsync();

    await Promise.all(
      component.allChildren.map(c=>FormComponent.initWithChildrenAsync(c, false))
    )
    
    if (isTopLevelBeingInited) {
      await FormComponent.postInitWithChildrenAsync(component);
    }
  }

  private static async postInitWithChildrenAsync(
    component: FormComponent<IFormComponentOptions, IFormComponentState>
  ) {
    await component.postInitComponentAsync();
    
    await Promise.all(
      component.allChildren.map(c=>FormComponent.postInitWithChildrenAsync(c))
    )
  }

  getComponentById(
    id: string
  ): FormComponent<IFormComponentOptions, IFormComponentState> | undefined {
    return this.topLevelComponent.getComponentByIdInternal(id);
  }

  private getComponentByIdInternal(
    id: string
  ): FormComponent<IFormComponentOptions, IFormComponentState> | undefined {
    if (this.id === id) {
      return this;
    }

    for (let child of this.allChildren) {
      let childResult = child.getComponentByIdInternal(id);
      if (childResult) {
        return childResult;
      }
    }

    return undefined;
  }

  @observable
  readonly parent:
    | FormComponent<IFormComponentOptions, IFormComponentState>
    | undefined;

  @computed get parentForm(): FormModel | undefined {
    if (this.parent) {
      return this.parent instanceof FormModel
        ? this.parent
        : this.parent.parentForm;
    }

    return undefined;
  }

  @computed
  get parentFieldNamePrefix(): string {
    return this.getDefaultParentFieldNamePrefix();
  }

  protected getDefaultParentFieldNamePrefix(): string {
    return this.parent?.parentFieldNamePrefix ?? "";
  }

  @computed get parentSection(): SectionModel | undefined {
    if (this.parent) {
      return this.parent instanceof SectionModel
        ? this.parent
        : this.parent.parentSection;
    }

    return undefined;
  }

  @computed get topLevelForm(): FormModel | undefined {
    return this.parent
      ? this.parent.topLevelForm
      : this instanceof FormModel
      ? this
      : undefined;
  }

  @computed get topLevelComponent(): FormComponent<
    IFormComponentOptions,
    IFormComponentState
  > {
    return this.parent ? this.parent.topLevelComponent : this;
  }

  abstract async insertAsync<
    T extends FormComponent<IFormComponentOptions, IFormComponentState>
  >(
    type: FormComponentConstructor<T, IFieldModelOptions>,
    index?: number,
    ...params: unknown[]
  ): Promise<T>;

  @computed
  get allChildren(): readonly FormComponent<
    IFormComponentOptions,
    IFormComponentState
  >[] {
    return this.getChildContainers().flatMap((c : FormComponent[]) => c);
  }

  protected abstract getChildContainers() : FormComponent[][];

  @computed
  get designerChildren(): readonly FormComponent<
    IFormComponentOptions,
    IFormComponentState
  >[] {
    return this.getDesignerChildren();
  }

  protected getDesignerChildren(): readonly FormComponent<
    IFormComponentOptions,
    IFormComponentState
  >[] {
    return this.allChildren;
  }

  @computed
  get designerLabel(): string {
    return this.getDesignerLabel();
  }

  @observable
  private internalTasksInProgress: ITaskModel[] = [];

  @computed
  get tasksInProgress(): readonly ITaskModel[] {
    return this.internalTasksInProgress;
  }

  @computed get allTasksInProgress(): readonly ITaskModel[] {
    let result = [...this.tasksInProgress];

    for (let child of this.allChildren) {
      result.push(...child.allTasksInProgress);
    }

    return result;
  }

  protected addTask(task: ITaskModel) {
    this.internalTasksInProgress.push(task);
    task.promise.finally(() => {
      this.internalTasksInProgress.splice(
        this.internalTasksInProgress.indexOf(task),
        1
      );
    });
  }

  protected abstract getDesignerLabel(): string;

  abstract focus(): void;

  abstract canInsert<
    T extends FormComponent<IFormComponentOptions, IFormComponentState>
  >(type: FormComponentConstructor<T, IFormComponentOptions>): boolean;

  protected async initComponentAsync(): Promise<void> {}

  protected async postInitComponentAsync(): Promise<void> {}
}
