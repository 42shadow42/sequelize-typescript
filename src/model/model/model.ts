import {InitOptions, Model as OriginModel, ModelAttributes, FindOptions, BuildOptions, Promise} from 'sequelize';
import {inferAlias} from '../../associations/alias-inference/alias-inference-service';
import {ModelNotInitializedError} from '../shared/model-not-initialized-error';
import {getAllPropertyNames} from '../../shared/object';

export type ModelType = typeof Model;
export type ModelCtor<M extends Model = Model> = (new () => M) & ModelType;

export type $GetType<T> = NonNullable<T> extends any[] ? NonNullable<T> : (NonNullable<T> | null);

export abstract class Model<T = any, T2 = any> extends OriginModel<T, T2> {

  // TODO Consider moving the following props to OriginModel
  id?: number | any;
  createdAt?: Date | any;
  updatedAt?: Date | any;
  deletedAt?: Date | any;
  version?: number | any;

  static isInitialized = false;

  static init(attributes: ModelAttributes, options: InitOptions): void {
    this.isInitialized = true;
    // @ts-ignore
    return super.init(attributes, options);
  }

  constructor(values?: object, options?: BuildOptions) {
    if (!new.target.isInitialized) {
      throw new ModelNotInitializedError(
        new.target,
        `${new.target.name} cannot be instantiated.`
      );
    }
    super(values, inferAlias(options, new.target));
  }

  reload(options?: FindOptions): Promise<this> {
    return super.reload(inferAlias(options, this));
  }

}

/**
 * Indicates which static methods of Model has to be proxied,
 * to prepare include option to automatically resolve alias;
 * The index represents the index of the options of the
 * corresponding method parameter
 */
export const INFER_ALIAS_MAP = {
  bulkBuild: 1,
  build: 1,
  create: 1,
  aggregate: 2,
  all: 0,
  find: 0,
  findAll: 0,
  findAndCount: 0,
  findAndCountAll: 0,
  findById: 1,
  findByPrimary: 1,
  findCreateFind: 0,
  findOne: 0,
  findOrBuild: 0,
  findOrCreate: 0,
  findOrInitialize: 0,
  reload: 0,
};

const staticModelFunctionProperties = getAllPropertyNames(OriginModel)
  .filter(key =>
    !isForbiddenMember(key) &&
    isFunctionMember(key, OriginModel) &&
    !isPrivateMember(key)
  );

function isFunctionMember(propertyKey: string, target: any): boolean {
  return typeof target[propertyKey] === 'function';
}

function isForbiddenMember(propertyKey: string): boolean {
  const FORBIDDEN_KEYS = ['name', 'constructor', 'length', 'prototype', 'caller', 'arguments', 'apply',
    'QueryInterface', 'QueryGenerator', 'init', 'replaceHookAliases', 'refreshAttributes', 'inspect'];
  return FORBIDDEN_KEYS.indexOf(propertyKey) !== -1;
}

function isPrivateMember(propertyKey: string): boolean {
  return (propertyKey.charAt(0) === '_');
}

function addThrowNotInitializedProxy(): void {
  staticModelFunctionProperties
  .forEach(key => {
    const superFn = Model[key];
    Model[key] = function(this: typeof Model, ...args: any[]): any {
      if (!this.isInitialized) {
        throw new ModelNotInitializedError(this, `Member "${key}" cannot be called.`);
      }
      return superFn.call(this, ...args);
    };
  });
}

function addInferAliasOverrides(): void {
  Object
  .keys(INFER_ALIAS_MAP)
    .forEach(key => {
      const optionIndex = INFER_ALIAS_MAP[key];
      const superFn = Model[key];
      Model[key] = function(this: typeof Model, ...args: any[]): any {
        args[optionIndex] = inferAlias(args[optionIndex], this);
        return superFn.call(this, ...args);
      };
    });
}

addThrowNotInitializedProxy();
addInferAliasOverrides();
